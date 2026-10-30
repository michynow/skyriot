import { SIEGE, TERRAIN_IMPACT } from '../content/frames';
import { sampleHeight } from '../terrain/heightfield';
import { TICK_HZ, type PilotInput } from '../types';
import type { ShipRec, SimCtx } from './ctx';
import {
  BANK_MAX_RAD,
  BANK_PER_STRAFE,
  BANK_PER_YAW_RATE,
  BANK_RATE_RAD,
  BOUNDARY_MARGIN,
  BRAKE_DECEL_MUL,
  FLOOR_CLEARANCE,
  HOVER_GAIN,
  HOVER_HEIGHT,
  HOVER_MAX_SPEED,
  IMPACT_SPEED_RETAIN,
  LATERAL_TAU_SEC,
  MIN_DIRECTION_LENGTH,
  SHIP_QUERY_GROUPS,
  STALL_FALL_SECONDS,
} from './constants';
import { damageShip } from './damage';
import { clamp, forwardOf, quatFromBasis, rightOf, upOf, uprightFrame } from './math';

// Module-scope scratch: the flight code runs for every Ship every tick.
const _f0 = [0, 0, 0];
const _f1 = [0, 0, 0];
const _r0 = [0, 0, 0];
const _u0 = [0, 0, 0];
const _r1 = [0, 0, 0];
const _u1 = [0, 0, 0];
const _up = [0, 0, 0];
const _rr = [0, 0, 0];
const _uu = [0, 0, 0];
const _vec = { x: 0, y: 0, z: 0 };
const _rot = { x: 0, y: 0, z: 0, w: 1 };
const _move = { x: 0, y: 0, z: 0 };

/** Toggle Siege Mode (Bulwark). Shared by the brake edge and the siege-anchor Skill. */
export function toggleSiege(rec: ShipRec): void {
  if (rec.state.frame === 'bulwark') rec.state.sieged = !rec.state.sieged;
}

/** Push body/collider to the ShipState transform. */
export function syncBody(ctx: SimCtx, rec: ShipRec): void {
  const s = rec.state;
  _vec.x = s.pos[0];
  _vec.y = s.pos[1];
  _vec.z = s.pos[2];
  rec.body.setTranslation(_vec, false);
  _rot.x = s.rot[0];
  _rot.y = s.rot[1];
  _rot.z = s.rot[2];
  _rot.w = s.rot[3];
  rec.body.setRotation(_rot, false);
  ctx.world.propagateModifiedBodyPositionsToColliders();
}

/**
 * The arcade flight integrator. Used identically by the authoritative step and by client
 * prediction (`stepLocal`); `allowDamage` only gates terrain-impact damage.
 */
export function stepFlight(
  ctx: SimCtx,
  rec: ShipRec,
  input: PilotInput,
  allowDamage: boolean,
): void {
  const s = rec.state;
  if (!s.alive) return;
  const dt = ctx.dt;
  const fd = ctx.frames[s.frame];
  const env = ctx.map.env;
  const space = env.kind === 'space';

  if (s.rollTicks > 0) s.rollTicks--;
  if (s.rollCooldownTicks > 0) s.rollCooldownTicks--;
  if (rec.dashTicks > 0) rec.dashTicks--;

  if (input.brake && !rec.prevBrake) toggleSiege(rec);
  rec.prevBrake = input.brake;
  const sieged = s.sieged;

  // ---- orientation: turn the nose toward aim, then bank ----
  forwardOf(s.rot, _f0);
  let ax = input.aim[0],
    ay = input.aim[1],
    az = input.aim[2];
  const alen = Math.hypot(ax, ay, az);
  if (alen > MIN_DIRECTION_LENGTH) {
    ax /= alen;
    ay /= alen;
    az /= alen;
  } else {
    ax = _f0[0]!;
    ay = _f0[1]!;
    az = _f0[2]!;
  }
  const maxTurn = fd.turnRate * (sieged ? SIEGE.turnRateMul : 1) * dt;
  const cosA = clamp(_f0[0]! * ax + _f0[1]! * ay + _f0[2]! * az, -1, 1);
  const angle = Math.acos(cosA);
  if (angle <= maxTurn || angle < 1e-5) {
    _f1[0] = ax;
    _f1[1] = ay;
    _f1[2] = az;
  } else if (Math.PI - angle < 1e-4) {
    // Aim directly behind: turn about the ship's right axis.
    rightOf(s.rot, _rr);
    const c = Math.cos(maxTurn),
      sn = Math.sin(maxTurn);
    _f1[0] = _f0[0]! * c + _rr[0]! * sn;
    _f1[1] = _f0[1]! * c + _rr[1]! * sn;
    _f1[2] = _f0[2]! * c + _rr[2]! * sn;
  } else {
    // Rotate f0 toward aim by maxTurn in their common plane.
    const sinA = Math.sin(angle);
    const wa = Math.sin(angle - maxTurn) / sinA;
    const wb = Math.sin(maxTurn) / sinA;
    _f1[0] = _f0[0]! * wa + ax * wb;
    _f1[1] = _f0[1]! * wa + ay * wb;
    _f1[2] = _f0[2]! * wa + az * wb;
  }
  const fl = Math.hypot(_f1[0]!, _f1[1]!, _f1[2]!);
  _f1[0] = _f1[0]! / fl;
  _f1[1] = _f1[1]! / fl;
  _f1[2] = _f1[2]! / fl;

  uprightFrame(_f0, s.rot, _r0, _u0);
  upOf(s.rot, _up);
  const bank0 = Math.atan2(
    _up[0]! * _r0[0]! + _up[1]! * _r0[1]! + _up[2]! * _r0[2]!,
    _up[0]! * _u0[0]! + _up[1]! * _u0[1]! + _up[2]! * _u0[2]!,
  );
  const yawRate = (_f0[2]! * _f1[0]! - _f0[0]! * _f1[2]!) / dt;
  const bankTarget = clamp(
    -yawRate * BANK_PER_YAW_RATE + input.strafe * BANK_PER_STRAFE,
    -BANK_MAX_RAD,
    BANK_MAX_RAD,
  );
  const bank = bank0 + clamp(bankTarget - bank0, -BANK_RATE_RAD * dt, BANK_RATE_RAD * dt);
  uprightFrame(_f1, s.rot, _r1, _u1);
  const cb = Math.cos(bank),
    sb = Math.sin(bank);
  for (let i = 0; i < 3; i++) {
    _rr[i] = _r1[i]! * cb - _u1[i]! * sb;
    _uu[i] = _u1[i]! * cb + _r1[i]! * sb;
  }
  quatFromBasis(_rr, _uu, _f1, s.rot);

  // ---- barrel roll ----
  if (
    (input.rollLeft || input.rollRight) &&
    s.rollCooldownTicks === 0 &&
    s.fuel >= fd.rollFuelCost &&
    !sieged
  ) {
    const dir = input.rollLeft ? -1 : 1;
    // Horizontal right of the nose (bank-free) so rolls are lateral in the world.
    const hx = -_f1[2]!,
      hz = _f1[0]!;
    const hl = Math.hypot(hx, hz) || 1;
    rec.lat[0] += (hx / hl) * dir * fd.rollImpulse;
    rec.lat[2] += (hz / hl) * dir * fd.rollImpulse;
    s.rollTicks = Math.ceil(fd.rollInvulnSec * TICK_HZ);
    s.rollCooldownTicks = Math.ceil(fd.rollCooldownSec * TICK_HZ);
    s.fuel -= fd.rollFuelCost;
    ctx.events.push({ type: 'barrelRoll', id: s.id, dir });
  }

  // ---- forward speed ----
  let target: number;
  let boosting = false;
  if (sieged) {
    target = 0;
  } else if (input.brake) {
    target = space ? 0 : fd.minSpeed;
  } else {
    target =
      input.throttle >= 0
        ? fd.cruiseSpeed + (fd.maxSpeed - fd.cruiseSpeed) * input.throttle
        : fd.cruiseSpeed + (fd.cruiseSpeed - fd.minSpeed) * input.throttle;
    if (rec.dashTicks > 0) {
      target = fd.boostSpeed;
    } else if (input.boost && s.fuel > 0) {
      target = fd.boostSpeed;
      boosting = true;
    }
  }
  s.fuel = clamp(s.fuel + (boosting ? -fd.fuelBurnPerSec : fd.fuelRegenPerSec) * dt, 0, 1);
  const delta = target - s.speed;
  const rate = (delta < 0 ? fd.accel * BRAKE_DECEL_MUL : fd.accel) * dt;
  s.speed += clamp(delta, -rate, rate);

  // ---- lateral / vertical velocity ----
  hRight(_f1, _rr);
  let ty = input.vertical * fd.verticalSpeed;
  let tx = _rr[0]! * input.strafe * fd.strafeSpeed;
  let tz = _rr[2]! * input.strafe * fd.strafeSpeed;
  if (sieged) {
    tx = 0;
    tz = 0;
  }
  if (!space) {
    if (fd.canHover && s.speed < HOVER_MAX_SPEED) {
      if (input.vertical === 0) {
        const ground = sampleHeight(ctx.hf, s.pos[0], s.pos[2]);
        ty = clamp(
          (ground + HOVER_HEIGHT - s.pos[1]) * HOVER_GAIN,
          -fd.verticalSpeed,
          fd.verticalSpeed,
        );
      }
    } else if (!fd.canHover && s.speed < env.stallSpeed) {
      ty -= env.gravity * STALL_FALL_SECONDS * (1 - s.speed / env.stallSpeed);
    }
  }
  const k = 1 - Math.exp(-dt / LATERAL_TAU_SEC);
  rec.lat[0] += (tx - rec.lat[0]) * k;
  rec.lat[1] += (ty - rec.lat[1]) * k;
  rec.lat[2] += (tz - rec.lat[2]) * k;

  // ---- move through the world ----
  const vx = _f1[0]! * s.speed + rec.lat[0];
  const vy = _f1[1]! * s.speed + rec.lat[1];
  const vz = _f1[2]! * s.speed + rec.lat[2];
  s.vel[0] = vx;
  s.vel[1] = vy;
  s.vel[2] = vz;
  const dx = vx * dt,
    dy = vy * dt,
    dz = vz * dt;
  _move.x = dx;
  _move.y = dy;
  _move.z = dz;
  // Collider still sits at the previous position (synced at end of last tick).
  ctx.controller.computeColliderMovement(rec.collider, _move, undefined, SHIP_QUERY_GROUPS);
  const m = ctx.controller.computedMovement();
  const lost = Math.hypot(dx - m.x, dy - m.y, dz - m.z) / dt;
  s.pos[0] += m.x;
  s.pos[1] += m.y;
  s.pos[2] += m.z;

  if (lost > TERRAIN_IMPACT.minSpeed) {
    const dmg = (lost - TERRAIN_IMPACT.minSpeed) * TERRAIN_IMPACT.damagePerMs;
    s.speed *= IMPACT_SPEED_RETAIN;
    if (rec.lat[1] < 0) rec.lat[1] = 0;
    if (allowDamage) {
      ctx.events.push({
        type: 'terrainImpact',
        id: s.id,
        damage: dmg,
        pos: [s.pos[0], s.pos[1], s.pos[2]],
      });
      damageShip(ctx, rec, dmg, null);
    }
  }

  // ---- hard limits ----
  const lim = ctx.map.size / 2 - BOUNDARY_MARGIN;
  s.pos[0] = clamp(s.pos[0], -lim, lim);
  s.pos[2] = clamp(s.pos[2], -lim, lim);
  const floor = sampleHeight(ctx.hf, s.pos[0], s.pos[2]) + FLOOR_CLEARANCE;
  if (s.pos[1] < floor) {
    s.pos[1] = floor;
    if (rec.lat[1] < 0) rec.lat[1] = 0;
  }
  if (s.pos[1] > ctx.map.ceiling) {
    s.pos[1] = ctx.map.ceiling;
    if (rec.lat[1] > 0) rec.lat[1] = 0;
  }
  syncBody(ctx, rec);
}

/** Horizontal (bank-free) right vector of forward `f`. */
function hRight(f: number[], out: number[]): void {
  const hx = -f[2]!,
    hz = f[0]!;
  const hl = Math.hypot(hx, hz) || 1;
  out[0] = hx / hl;
  out[1] = 0;
  out[2] = hz / hl;
}

/** Recompute hidden lateral velocity after a state overwrite (reconciliation). */
export function deriveLateral(rec: ShipRec): void {
  forwardOf(rec.state.rot, _f0);
  for (let i = 0; i < 3; i++) rec.lat[i] = rec.state.vel[i]! - _f0[i]! * rec.state.speed;
}
