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
  /** Advance exactly one tick. Missing input for a Ship = EMPTY_INPUT. */
  step(inputs: ReadonlyMap<ShipId, PilotInput>): SimEvent[];
  getShip(id: ShipId): ShipState | undefined;
  ships(): Iterable<ShipState>;
  /** Overwrite a Ship's state (client reconciliation). */
  setShipState(id: ShipId, state: ShipState): void;
  /** Client prediction: step only these Ships, no Projectile damage authority. */
  stepLocal(id: ShipId, input: PilotInput): void;
  /** Static-world collider wireframe for the dev debug view: flat [x,y,z,...] line segments. */
  debugLines(): Float32Array;
  dispose(): void;
}

export interface SimOptions {
  /** Initialised `@dimforge/rapier3d-compat` module (caller awaits RAPIER.init()). */
  rapier: typeof import('@dimforge/rapier3d-compat');
  /** true on server: Projectiles deal damage, respawns happen. */
  authoritative: boolean;
}

export { createSim } from './createSim';
