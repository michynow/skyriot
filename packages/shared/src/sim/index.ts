import type {
  MapDef,
  MatchState,
  NationId,
  PilotInput,
  ShipId,
  ShipSpawn,
  ShipState,
  SimEvent,
  SkillId,
  StructureKind,
  StructureState,
  Vec3,
} from '../types';
import type { ShipGear } from '../content/economy';

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
   * Equip a Ship (engine stats, upgraded weapons, visual tier/upgrade). Kept by id, so it may be set before
   * addShip; removeShip clears it. Server and client prediction must pass the same gear.
   */
  setGear(id: ShipId, gear: ShipGear): void;
  /**
   * Advance exactly one tick. Missing input for a Ship = EMPTY_INPUT. Ships in `frozen` skip their own
   * logic this tick (a human whose input is late: stays in lockstep with client prediction).
   */
  step(inputs: ReadonlyMap<ShipId, PilotInput>, frozen?: ReadonlySet<ShipId>): SimEvent[];
  getShip(id: ShipId): ShipState | undefined;
  ships(): Iterable<ShipState>;
  /** Overwrite a Ship's state (client reconciliation). */
  setShipState(id: ShipId, state: ShipState): void;
  /**
   * Step one Ship only. Client prediction: movement and movement Skills, no damage authority. On the
   * authoritative sim (input catch-up) it is that Ship's full tick; its events come with the next step().
   */
  stepLocal(id: ShipId, input: PilotInput): void;
  /** Move a Ship (dev /tp): clears dock/ground state, syncs the body, emits a `teleport` event next step. */
  teleport(id: ShipId, pos: Vec3): void;
  /** Live missiles with server-side path (for snapshots). `target` is the Ship each homes on. */
  missiles(): MissileView[];
  /** All Base structures (both Nations), live objects. */
  structures(): StructureState[];
  /** Battle state and Launch Queues (queues are only kept by the authoritative sim). */
  match(): MatchState;
  /** Client: mirror server structures so colliders and shield domes match the server. */
  setStructures(list: readonly StructureState[]): void;
  /** Dev: cast any Skill of the Ship's Frame kit, hotbar or not (no cooldown). False if it can't. */
  castSkill(id: ShipId, skill: SkillId): boolean;
  /** Dev: destroy every live structure of a kind in a Nation's Base. Returns how many. */
  destroyStructures(nation: NationId, kind: StructureKind): number;
  /** Dev: end the Battle now with `winner`; Bases rebuild after the usual delay. */
  endBattle(winner: NationId): void;
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
export { isCloaked } from './buffs';
// Skill area sizes the client draws.
export {
  BREACH_RADIUS,
  CLOAK_REVEAL_M,
  DAMAGE_AURA_RADIUS,
  QUAKE_DISTANCE,
  QUAKE_RADIUS,
  HEAL_FIELD_RADIUS,
  SCAN_RADIUS,
  SNARE_RANGE,
} from './constants';
// Projectile tuning the client needs to draw where Secondary / bombing Skills will land.
export {
  AIR_BARRAGE_COUNT,
  AIR_BARRAGE_SPREAD_RAD,
  BOMB_DROP_SPEED,
  BOMB_GRAVITY,
  GROUND_STRIKE_SPLASH_MUL,
  LAND_DECK_RANGE,
  NOSE_OFFSET,
  ROLL_DURATION_SEC,
} from './constants';
export { bombingSecondary } from './combat';
