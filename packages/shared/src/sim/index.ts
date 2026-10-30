import type { MapDef, PilotInput, ShipId, ShipSpawn, ShipState, SimEvent, Vec3 } from '../types';

// Contract for the shared simulation (docs/ARCHITECTURE.md §2.1). Implementation owned by the sim agent.

export interface SimTuning {
  /** Per-Frame overrides of FrameDef numbers, set live by the dev panel. */
  frames: Partial<Record<string, Record<string, number>>>;
  timescale: number;
  god: Set<ShipId>;
}

export interface Sim {
  readonly tick: number;
  readonly tuning: SimTuning;
  addShip(id: ShipId, spawn: ShipSpawn, at?: Vec3): ShipState;
  removeShip(id: ShipId): void;
  /**
   * Advance exactly one tick. Missing input for a Ship = EMPTY_INPUT. Ships in `frozen` skip their own
   * logic this tick (a human whose input is late: stays in lockstep with client prediction).
   */
  step(inputs: ReadonlyMap<ShipId, PilotInput>, frozen?: ReadonlySet<ShipId>): SimEvent[];
  getShip(id: ShipId): ShipState | undefined;
  ships(): Iterable<ShipState>;
  /** Overwrite a Ship's state (client reconciliation). */
  setShipState(id: ShipId, state: ShipState): void;
  /** Client prediction: step only these Ships, no Projectile damage authority. */
  stepLocal(id: ShipId, input: PilotInput): void;
  /** Move a Ship (dev /tp): clears dock/ground state, syncs the body, emits a `teleport` event next step. */
  teleport(id: ShipId, pos: Vec3): void;
  /** Live missiles with server-side path (for snapshots). `target` is the Ship each homes on. */
  missiles(): MissileView[];
  /** Static-world collider wireframe for the dev debug view: flat [x,y,z,...] line segments. */
  debugLines(): Float32Array;
  dispose(): void;
}

export interface MissileView {
  id: number;
  pos: Vec3;
  vel: Vec3;
  guided: boolean;
  target: ShipId | null;
}

export interface SimOptions {
  /** Initialised `@dimforge/rapier3d-compat` module (caller awaits RAPIER.init()). */
  rapier: typeof import('@dimforge/rapier3d-compat');
  /** true on server: Projectiles deal damage, respawns happen. */
  authoritative: boolean;
}

export { createSim } from './createSim';
