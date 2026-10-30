import { TICK_HZ, type ShipId, type ShipState, type Snapshot } from '@skyriot/shared';

const BUFFER_MAX = 40;
const EXTRAPOLATE_MAX_MS = 250;
const TELEPORT_DIST = 200; // m between consecutive snapshots => respawn/teleport, snap
const TICK_MS = 1000 / TICK_HZ;
const SLEW_MS_PER_SNAPSHOT = 1.5; // max clock-offset change per snapshot (~30 ms/s)

interface Entry {
  snap: Snapshot;
  byId: Map<ShipId, ShipState>;
}

export interface Interpolator {
  /** rtt (ms) refines the server-clock estimate: serverNow ~ serverTimeMs + rtt/2. */
  push(snap: Snapshot, rttMs?: number): void;
  /** Remote-ship render states at performance.now()-style `nowMs`, ~delay behind. Map is reused. */
  sample(nowMs: number): ReadonlyMap<ShipId, ShipState>;
  /** Server tick being rendered by the last sample() (for PilotInput.viewTick). */
  renderTick(): number;
  /** Estimated current server tick. */
  latestTick(nowMs: number): number;
}

function cloneShip(s: ShipState): ShipState {
  return { ...s, pos: [...s.pos], rot: [...s.rot], vel: [...s.vel] };
}

function copyInto(dst: ShipState, src: ShipState): void {
  const { pos, rot, vel } = dst;
  Object.assign(dst, src);
  dst.pos = pos;
  dst.rot = rot;
  dst.vel = vel;
  for (let i = 0; i < 3; i++) {
    pos[i] = src.pos[i]!;
    vel[i] = src.vel[i]!;
  }
  for (let i = 0; i < 4; i++) rot[i] = src.rot[i]!;
}

export function createInterpolator(delayMs = 100): Interpolator {
  const buf: Entry[] = [];
  const cache = new Map<ShipId, ShipState>();
  const out = new Map<ShipId, ShipState>();
  let offset = 0; // serverTimeMs - localNow
  let haveOffset = false;
  const samples: number[] = [];
  let tick = 0;

  function place(dst: ShipState, a: ShipState | undefined, b: ShipState, t: number, extraSec: number) {
    copyInto(dst, b);
    if (extraSec > 0) {
      for (let i = 0; i < 3; i++) dst.pos[i] = b.pos[i]! + b.vel[i]! * extraSec;
      return;
    }
    if (!a || t >= 1 || !a.alive || !b.alive) return;
    let dist2 = 0;
    for (let i = 0; i < 3; i++) dist2 += (b.pos[i]! - a.pos[i]!) ** 2;
    if (dist2 > TELEPORT_DIST * TELEPORT_DIST) return;
    for (let i = 0; i < 3; i++) dst.pos[i] = a.pos[i]! + (b.pos[i]! - a.pos[i]!) * t;
    // ponytail: nlerp, not slerp; error is negligible at 20 Hz snapshots. Swap if banking looks off.
    let dot = 0;
    for (let i = 0; i < 4; i++) dot += a.rot[i]! * b.rot[i]!;
    const sign = dot < 0 ? -1 : 1;
    let len = 0;
    for (let i = 0; i < 4; i++) {
      const v = a.rot[i]! * sign + (b.rot[i]! - a.rot[i]! * sign) * t;
      dst.rot[i] = v;
      len += v * v;
    }
    len = Math.sqrt(len) || 1;
    for (let i = 0; i < 4; i++) dst.rot[i] = dst.rot[i]! / len;
  }

  return {
    push(snap, rttMs = 0) {
      const sample = snap.serverTimeMs + rttMs / 2 - performance.now();
      // Late packets only ever lower the sample, so the best estimate is the max over a ~2 s window.
      // The live offset slews toward it at a bounded rate so render time never jitters per snapshot.
      samples.push(sample);
      if (samples.length > 40) samples.shift();
      const best = Math.max(...samples);
      if (!haveOffset) {
        offset = best;
        haveOffset = true;
      } else {
        const step = SLEW_MS_PER_SNAPSHOT;
        offset += Math.max(-step, Math.min(step, best - offset));
      }
      if (buf.some((e) => e.snap.tick === snap.tick)) return;
      const entry: Entry = { snap, byId: new Map(snap.ships.map((s) => [s.id, s])) };
      let i = buf.length;
      while (i > 0 && buf[i - 1]!.snap.serverTimeMs > snap.serverTimeMs) i--;
      buf.splice(i, 0, entry);
      if (buf.length > BUFFER_MAX) buf.shift();
    },

    sample(nowMs) {
      out.clear();
      const last = buf[buf.length - 1];
      if (!last) return out;
      const renderT = nowMs + offset - delayMs;
      let i = buf.length - 1;
      while (i > 0 && buf[i]!.snap.serverTimeMs > renderT) i--;
      const a = buf[i]!;
      const b = buf[i + 1];
      let t = 0;
      let extraSec = 0;
      let target: Entry;
      let from: Entry | undefined;
      if (b) {
        from = a;
        target = b;
        const span = b.snap.serverTimeMs - a.snap.serverTimeMs || 1;
        t = Math.min(Math.max((renderT - a.snap.serverTimeMs) / span, 0), 1);
        tick = a.snap.tick + (b.snap.tick - a.snap.tick) * t;
      } else {
        target = a;
        const over = renderT - a.snap.serverTimeMs;
        if (over > 0) {
          extraSec = Math.min(over, EXTRAPOLATE_MAX_MS) / 1000;
          tick = a.snap.tick + over / TICK_MS;
        } else tick = a.snap.tick;
      }
      for (const ship of target.snap.ships) {
        let dst = cache.get(ship.id);
        if (!dst) {
          dst = cloneShip(ship);
          cache.set(ship.id, dst);
        }
        place(dst, from?.byId.get(ship.id), ship, t, extraSec);
        out.set(ship.id, dst);
      }
      if (cache.size > out.size + 16) for (const id of cache.keys()) if (!last.byId.has(id)) cache.delete(id);
      return out;
    },

    renderTick: () => tick,

    latestTick(nowMs) {
      const last = buf[buf.length - 1];
      if (!last) return 0;
      return last.snap.tick + Math.max(0, nowMs + offset - last.snap.serverTimeMs) / TICK_MS;
    },
  };
}
