import { Quaternion } from 'three';
import type { PilotInput, Quat, ShipId, ShipState, Sim, Snapshot, Vec3 } from '@skyriot/shared';

const PENDING_MAX = 120;
const SNAP_DIST = 30; // m of error beyond which we snap instead of smoothing
const SMOOTH_TAU_SEC = 0.1; // visual error offset decays with this time constant
const STATS_WINDOW_MS = 10_000;

export interface PredictorStats {
  /** Reconcile position error (m) over the last 10 s. */
  avg: number;
  max: number;
  count: number;
}

export interface Predictor {
  applyLocal(input: PilotInput): void;
  onServerSnapshot(snap: Snapshot): void;
  /**
   * Render state of the own Ship: interpolated between the previous and current predicted tick by
   * `alpha` (fixed-step accumulator / TICK_DT) plus the decaying reconcile offset. Reused object.
   */
  ownState(alpha: number): ShipState | null;
  stats(): PredictorStats;
  /** Server teleported the own Ship: drop the error offset and replay buffer, hard-snap on the next snapshot. */
  teleport(): void;
}

function cloneShip(s: ShipState): ShipState {
  return { ...s, pos: [...s.pos], rot: [...s.rot], vel: [...s.vel], cooldowns: [...s.cooldowns] };
}

const _a = new Quaternion();
const _b = new Quaternion();

export function createPredictor(sim: Sim, ownId: ShipId): Predictor {
  let pending: PilotInput[] = [];
  let lastTick = -1;
  const offset: Vec3 = [0, 0, 0];
  const prevPos: Vec3 = [0, 0, 0];
  const currPos: Vec3 = [0, 0, 0];
  const prevRot: Quat = [0, 0, 0, 1];
  const currRot: Quat = [0, 0, 0, 1];
  let lastRender = performance.now();
  let render: ShipState | null = null;
  const errors: { at: number; err: number }[] = [];
  let forceSnap = false;

  function capture() {
    const s = sim.getShip(ownId);
    if (!s) return;
    for (let i = 0; i < 3; i++) currPos[i] = s.pos[i]!;
    for (let i = 0; i < 4; i++) currRot[i] = s.rot[i]!;
  }
  function stepRecorded(input: PilotInput) {
    for (let i = 0; i < 3; i++) prevPos[i] = currPos[i]!;
    for (let i = 0; i < 4; i++) prevRot[i] = currRot[i]!;
    sim.stepLocal(ownId, input);
    capture();
  }
  function resetHistory() {
    capture();
    for (let i = 0; i < 3; i++) prevPos[i] = currPos[i]!;
    for (let i = 0; i < 4; i++) prevRot[i] = currRot[i]!;
  }

  return {
    applyLocal(input) {
      if (!sim.getShip(ownId)) return;
      pending.push(input);
      if (pending.length > PENDING_MAX) pending.shift();
      stepRecorded(input);
    },

    onServerSnapshot(snap) {
      if (snap.tick <= lastTick) return;
      lastTick = snap.tick;
      sim.setStructures(snap.structures);
      const own = snap.ships.find((s) => s.id === ownId);
      if (!own) return;
      const existing = sim.getShip(ownId);
      if (!existing) {
        sim.addShip(
          ownId,
          { nation: own.nation, frame: own.frame, name: own.name, isBot: false, tier: own.tier, upgrade: own.upgrade },
          own.pos,
        );
        sim.setShipState(ownId, cloneShip(own));
        resetHistory();
        return;
      }
      const before: Vec3 = [currPos[0], currPos[1], currPos[2]];
      const wasAlive = existing.alive;
      if (forceSnap) {
        forceSnap = false;
        pending = [];
        offset[0] = offset[1] = offset[2] = 0;
      }
      pending = pending.filter((p) => p.seq > snap.ack);
      sim.setShipState(ownId, cloneShip(own));
      resetHistory();
      if (own.alive) for (const p of pending) stepRecorded(p);
      let err2 = 0;
      for (let i = 0; i < 3; i++) err2 += (before[i]! - currPos[i]!) ** 2;
      const err = Math.sqrt(err2);
      if (err2 > SNAP_DIST * SNAP_DIST || wasAlive !== own.alive || !own.alive) {
        offset[0] = offset[1] = offset[2] = 0;
        if (!own.alive) pending = [];
      } else {
        for (let i = 0; i < 3; i++) offset[i] = offset[i]! + before[i]! - currPos[i]!;
        const now = performance.now();
        errors.push({ at: now, err });
        while (errors.length && now - errors[0]!.at > STATS_WINDOW_MS) errors.shift();
      }
    },

    ownState(alpha) {
      const ship = sim.getShip(ownId);
      if (!ship) return null;
      const now = performance.now();
      const k = Math.exp(-(now - lastRender) / 1000 / SMOOTH_TAU_SEC);
      lastRender = now;
      for (let i = 0; i < 3; i++) offset[i] = offset[i]! * k;
      const t = Math.min(1, Math.max(0, alpha));
      if (!render) render = cloneShip(ship);
      const { pos, rot, vel } = render;
      Object.assign(render, ship);
      render.pos = pos;
      render.rot = rot;
      render.vel = vel;
      for (let i = 0; i < 3; i++) {
        pos[i] = prevPos[i]! + (currPos[i]! - prevPos[i]!) * t + offset[i]!;
        vel[i] = ship.vel[i]!;
      }
      _a.set(prevRot[0], prevRot[1], prevRot[2], prevRot[3]);
      _b.set(currRot[0], currRot[1], currRot[2], currRot[3]);
      _a.slerp(_b, t);
      rot[0] = _a.x;
      rot[1] = _a.y;
      rot[2] = _a.z;
      rot[3] = _a.w;
      return render;
    },

    teleport() {
      pending = [];
      offset[0] = offset[1] = offset[2] = 0;
      forceSnap = true;
    },

    stats() {
      const now = performance.now();
      while (errors.length && now - errors[0]!.at > STATS_WINDOW_MS) errors.shift();
      let sum = 0;
      let max = 0;
      for (const e of errors) {
        sum += e.err;
        if (e.err > max) max = e.err;
      }
      return { avg: errors.length ? sum / errors.length : 0, max, count: errors.length };
    },
  };
}
