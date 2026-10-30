import { FORMATION, LAUNCH } from '../content/bases';
import { sampleHeight } from '../terrain/heightfield';
import { TICK_DT, TICK_HZ, type PilotInput, type Quat, type Vec3 } from '../types';
import type { ShipRec, SimCtx } from './ctx';
import { syncBody } from './flight';
import { NATIONS } from './structures';

const STAGING_TICKS = Math.ceil(LAUNCH.stagingSec * TICK_HZ);
const READY_TIMEOUT_TICKS = Math.ceil(LAUNCH.readyTimeoutSec * TICK_HZ);
const TUNNEL_COOLDOWN_TICKS = Math.ceil(LAUNCH.tunnelCooldownSec * TICK_HZ);

/** Put a (reset) Ship into its Base's hangar, at the back of the Launch Queue. */
export function enterHangar(ctx: SimCtx, rec: ShipRec): void {
  const s = rec.state;
  const base = ctx.map.bases[s.nation];
  s.launchPhase = 'hangar';
  s.tunnel = -1;
  s.launchTicks = 0;
  s.pos[0] = base.core[0];
  s.pos[1] = base.core[1] - LAUNCH.hangarDepthM;
  s.pos[2] = base.core[2];
  hold(ctx, rec, base.facing);
  const queue = ctx.match.queues[s.nation];
  if (!queue.includes(s.id)) {
    // Humans go out before every Bot (FIFO among humans); Bots join the back.
    let at = queue.length;
    if (!s.isBot) {
      at = queue.findIndex((id) => ctx.ships.get(id)?.state.isBot !== false);
      if (at < 0) at = queue.length;
    }
    queue.splice(at, 0, s.id);
  }
  s.queuePos = queue.indexOf(s.id);
}

/** Skip the queue: start flying at cruise speed in the next formation slot ahead of the Base. */
export function deployInFormation(ctx: SimCtx, rec: ShipRec): void {
  const s = rec.state;
  leaveQueue(ctx, rec);
  const base = ctx.map.bases[s.nation];
  const slot = ctx.formationSlot[s.nation]++;
  const row = Math.floor(slot / FORMATION.perRow);
  const column = (slot % FORMATION.perRow) - (FORMATION.perRow - 1) / 2;
  const ahead = FORMATION.aheadM + row * FORMATION.rowSpacingM;
  const side = column * FORMATION.columnSpacingM;
  const f = base.facing;
  const x = base.core[0] + f[0] * ahead + f[2] * side;
  const z = base.core[2] + f[2] * ahead - f[0] * side;
  s.pos[0] = x;
  s.pos[1] = Math.max(
    base.core[1] + FORMATION.altitudeM,
    sampleHeight(ctx.hf, x, z) + FORMATION.minClearanceM,
  );
  s.pos[2] = z;
  s.launchPhase = 'none';
  s.tunnel = -1;
  s.launchTicks = 0;
  hold(ctx, rec, f);
  s.speed = ctx.frames[s.frame].cruiseSpeed;
  for (let i = 0; i < 3; i++) s.vel[i] = f[i]! * s.speed;
}

/** Drop a Ship from its Launch Queue (left the Map Instance, teleported). */
export function leaveQueue(ctx: SimCtx, rec: ShipRec): void {
  const queue = ctx.match.queues[rec.state.nation];
  const i = queue.indexOf(rec.state.id);
  if (i >= 0) queue.splice(i, 1);
  rec.state.queuePos = -1;
}

/** Authoritative: stage the head of each Launch Queue into a free Launch Tunnel. */
export function stepLaunchQueue(ctx: SimCtx): void {
  for (const nation of NATIONS) {
    const queue = ctx.match.queues[nation];
    const tunnels = ctx.map.bases[nation].tunnels;
    const free = ctx.tunnelFreeTick[nation];
    for (let i = 0; i < tunnels.length && queue.length > 0; i++) {
      if (ctx.tick < free[i]! || tunnelBusy(ctx, nation, i)) continue;
      const rec = ctx.ships.get(queue.shift()!);
      if (!rec || rec.state.launchPhase !== 'hangar') continue;
      const s = rec.state;
      const tunnel = tunnels[i]!;
      s.launchPhase = 'staging';
      s.tunnel = i;
      s.launchTicks = STAGING_TICKS;
      s.queuePos = -1;
      s.pos[0] = tunnel.start[0];
      s.pos[1] = tunnel.start[1];
      s.pos[2] = tunnel.start[2];
      hold(ctx, rec, tunnel.dir);
      free[i] = ctx.tick + TUNNEL_COOLDOWN_TICKS;
      ctx.events.push({ type: 'launchStaged', id: s.id, tunnel: i });
    }
    for (let k = 0; k < queue.length; k++) {
      const rec = ctx.ships.get(queue[k]!);
      if (rec) rec.state.queuePos = k;
    }
  }
}

function tunnelBusy(ctx: SimCtx, nation: string, tunnel: number): boolean {
  for (const s of ctx.list) if (s.nation === nation && s.tunnel === tunnel) return true;
  return false;
}

/**
 * One tick of a Ship in the hangar or a Launch Tunnel (replaces flight). Deterministic from state and
 * input, so client prediction runs it too: staging counts down, full throttle (or a Bot, or the
 * timeout) fires the catapult, the catapult accelerates evenly to boost speed at the tunnel exit.
 */
export function stepLaunch(ctx: SimCtx, rec: ShipRec, input: PilotInput): void {
  const s = rec.state;
  switch (s.launchPhase) {
    case 'staging':
      if (--s.launchTicks <= 0) {
        s.launchPhase = 'ready';
        s.launchTicks = READY_TIMEOUT_TICKS;
      }
      return;
    case 'ready':
      if (s.isBot || input.throttle >= LAUNCH.readyThrottle || --s.launchTicks <= 0) {
        s.launchPhase = 'catapult';
        s.launchTicks = strokeTicks(ctx, rec);
        ctx.events.push({ type: 'catapult', id: s.id, tunnel: s.tunnel });
      }
      return;
    case 'catapult': {
      const tunnel = ctx.map.bases[s.nation].tunnels[s.tunnel];
      if (!tunnel) {
        s.launchPhase = 'none';
        return;
      }
      const stroke = strokeTicks(ctx, rec);
      const exitSpeed = ctx.frames[s.frame].boostSpeed;
      s.launchTicks--;
      const p = Math.min(1 - s.launchTicks / stroke, 1);
      const d = tunnel.length * p * p;
      s.speed = exitSpeed * p;
      for (let i = 0; i < 3; i++) {
        s.pos[i] = tunnel.start[i]! + tunnel.dir[i]! * d;
        s.vel[i] = tunnel.dir[i]! * s.speed;
      }
      if (s.launchTicks <= 0) {
        s.launchPhase = 'none';
        s.tunnel = -1;
        s.launchTicks = 0;
      }
      syncBody(ctx, rec);
      return;
    }
  }
}

/** Catapult stroke: uniform acceleration from rest to boost speed over the tunnel length. */
function strokeTicks(ctx: SimCtx, rec: ShipRec): number {
  const s = rec.state;
  const tunnel = ctx.map.bases[s.nation].tunnels[s.tunnel];
  const length = tunnel ? tunnel.length : 0;
  return Math.max(1, Math.round((2 * length) / ctx.frames[s.frame].boostSpeed / TICK_DT));
}

/** Stationary, nose along `dir`. */
function hold(ctx: SimCtx, rec: ShipRec, dir: Vec3): void {
  const s = rec.state;
  dirToQuat(dir, s.rot);
  s.vel[0] = s.vel[1] = s.vel[2] = 0;
  s.speed = 0;
  s.angVel[0] = s.angVel[1] = s.angVel[2] = 0;
  rec.lat[0] = rec.lat[1] = rec.lat[2] = 0;
  syncBody(ctx, rec);
}

/** Yaw then pitch taking forward (0,0,-1) onto `dir`. */
function dirToQuat(dir: Vec3, out: Quat): void {
  const yaw = Math.atan2(-dir[0], -dir[2]);
  const pitch = Math.asin(Math.min(Math.max(dir[1], -1), 1));
  const sy = Math.sin(yaw / 2),
    cy = Math.cos(yaw / 2),
    sp = Math.sin(pitch / 2),
    cp = Math.cos(pitch / 2);
  out[0] = cy * sp;
  out[1] = sy * cp;
  out[2] = -sy * sp;
  out[3] = cy * cp;
}
