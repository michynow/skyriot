import type { PilotInput, ShipId, ShipState, Sim, Snapshot, Vec3 } from '@skyriot/shared';

const PENDING_MAX = 120;
const SNAP_DIST = 30; // m of error beyond which we snap instead of smoothing
const SMOOTH_TAU_SEC = 0.08; // visual error decays to ~5% in ~100-250 ms

export interface Predictor {
  applyLocal(input: PilotInput): void;
  onServerSnapshot(snap: Snapshot): void;
  /** Render state of the own Ship (predicted + smoothed). Null until the first snapshot. Reused object. */
  ownState(): ShipState | null;
}

function cloneShip(s: ShipState): ShipState {
  return { ...s, pos: [...s.pos], rot: [...s.rot], vel: [...s.vel], cooldowns: [...s.cooldowns] };
}

export function createPredictor(sim: Sim, ownId: ShipId): Predictor {
  let pending: PilotInput[] = [];
  let lastTick = -1;
  const offset: Vec3 = [0, 0, 0];
  let lastRender = performance.now();
  let render: ShipState | null = null;

  return {
    applyLocal(input) {
      if (!sim.getShip(ownId)) return;
      pending.push(input);
      if (pending.length > PENDING_MAX) pending.shift();
      sim.stepLocal(ownId, input);
    },

    onServerSnapshot(snap) {
      if (snap.tick <= lastTick) return;
      lastTick = snap.tick;
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
        return;
      }
      const before: Vec3 = [...existing.pos];
      const wasAlive = existing.alive;
      pending = pending.filter((p) => p.seq > snap.ack);
      sim.setShipState(ownId, cloneShip(own));
      if (own.alive) for (const p of pending) sim.stepLocal(ownId, p);
      const after = sim.getShip(ownId);
      if (!after) return;
      let err2 = 0;
      for (let i = 0; i < 3; i++) err2 += (before[i]! - after.pos[i]!) ** 2;
      if (err2 > SNAP_DIST * SNAP_DIST || wasAlive !== own.alive || !own.alive) {
        offset[0] = offset[1] = offset[2] = 0;
        if (!own.alive) pending = [];
      } else for (let i = 0; i < 3; i++) offset[i] = offset[i]! + before[i]! - after.pos[i]!;
    },

    ownState() {
      const ship = sim.getShip(ownId);
      if (!ship) return null;
      const now = performance.now();
      const k = Math.exp(-(now - lastRender) / 1000 / SMOOTH_TAU_SEC);
      lastRender = now;
      for (let i = 0; i < 3; i++) offset[i] = offset[i]! * k;
      if (!render) render = cloneShip(ship);
      const { pos, rot, vel } = render;
      Object.assign(render, ship);
      render.pos = pos;
      render.rot = rot;
      render.vel = vel;
      for (let i = 0; i < 3; i++) {
        pos[i] = ship.pos[i]! + offset[i]!;
        vel[i] = ship.vel[i]!;
      }
      for (let i = 0; i < 4; i++) rot[i] = ship.rot[i]!;
      return render;
    },
  };
}
