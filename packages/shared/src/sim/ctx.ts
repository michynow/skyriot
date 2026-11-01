import type {
  Collider,
  KinematicCharacterController,
  Ray,
  RigidBody,
  World,
} from '@dimforge/rapier3d-compat';
import type { Heightfield } from '../terrain/heightfield';
import type {
  FrameDef,
  FrameId,
  MapDef,
  MatchState,
  NationId,
  ProjectileKind,
  ShipId,
  ShipState,
  SimEvent,
  StructureState,
} from '../types';
import type { SimTuning } from './index';

/** Resolved buff modifiers (derived from ShipState.buffs once per tick). */
export interface BuffMods {
  fireRateMul: number;
  speedMul: number;
  turnRateMul: number;
  deflectAdd: number;
  damageMul: number;
  damageTakenMul: number;
  maxHpMul: number;
  shieldRegenMul: number;
  fuelRegenMul: number;
  lockTimeMul: number;
  splashMul: number;
}

export interface ShipRec {
  mods: BuffMods;
  state: ShipState;
  body: RigidBody;
  collider: Collider;
  /** World-space velocity not along the nose (strafe, vertical, roll, stall fall). Derivable from state. */
  lat: [number, number, number];
  fireCd: [number, number];
  shieldDelay: number;
  lockCand: ShipId | null;
  lockTime: number;
  spawnCounter: number;
  /** Lag-comp ring: x,y,z,fx,fy,fz per slot, tagged by tick. */
  histPos: Float32Array;
  histTick: Int32Array;
}

export interface Projectile {
  id: number;
  owner: ShipId;
  nation: NationId;
  kind: ProjectileKind;
  weapon: string;
  damage: number;
  splash: number;
  speed: number;
  range: number;
  travelled: number;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  homing: number;
  target: ShipId | null;
  spawnTick: number;
  rewind: number;
  /** Seconds the terrain has blocked line of sight to the target (missiles). */
  losTime: number;
  /** Downward acceleration (bombs); 0 for straight-flying projectiles. */
  gravity: number;
  /** Damage multiplier vs Grounded/Docked victims (ground-strike bombs). */
  groundMul: number;
  /** Current weave offset amplitude (m) already applied to the position. */
  weaveAmp: number;
}

export interface Wall {
  x: number;
  y: number;
  z: number;
  nation: NationId;
  expireTick: number;
}

export interface StructureRec {
  state: StructureState;
  collider: Collider;
  radius: number;
  height: number;
  /** Turret: seconds until the next shot. */
  fireCd: number;
  /** Turret as a Projectile owner (spawnProjectile reads `state.id` / `state.nation`). */
  shooter: { state: { id: string; nation: NationId } };
}

export interface SimCtx {
  map: MapDef;
  hf: Heightfield;
  authoritative: boolean;
  rapier: typeof import('@dimforge/rapier3d-compat');
  world: World;
  controller: KinematicCharacterController;
  terrain: Collider;
  ray: Ray;
  rng: () => number;
  tick: number;
  dt: number;
  tuning: SimTuning;
  /** Effective (tuning-merged) Frame defs. */
  frames: Record<FrameId, FrameDef>;
  ships: Map<ShipId, ShipRec>;
  list: ShipState[];
  recList: ShipRec[];
  projectiles: Projectile[];
  pool: Projectile[];
  walls: Wall[];
  nextProjectileId: number;
  events: SimEvent[];
  structures: StructureRec[];
  /** Collider handle -> structure, to tell a Projectile hitting a structure from one hitting terrain. */
  structureByCollider: Map<number, StructureRec>;
  /** Index of each Nation's Core in `structures`. */
  coreIndex: Record<NationId, number>;
  match: MatchState;
  /** Per Base, per Launch Tunnel: first tick it may stage the next Ship. */
  tunnelFreeTick: Record<NationId, number[]>;
  /** Next free formation slot per Nation for pre-deployed Bots (reset each Battle). */
  formationSlot: Record<NationId, number>;
}
