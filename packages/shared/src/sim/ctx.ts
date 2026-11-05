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
import type { ResolvedGear } from './gear';

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
  accuracyAdd: number;
  splashMul: number;
  hpRegenPerSec: number;
  cloak: boolean;
  damageAuraDps: number;
  salvoAdd: number;
  primaryDamageMul: number;
  secondaryDamageMul: number;
  secondaryFireRateMul: number;
  spreadMul: number;
  lockConeMul: number;
  shieldDamageTakenMul: number;
  secondaryDamageTakenMul: number;
  collisionDamageMul: number;
  invulnerable: boolean;
  noAttack: boolean;
  rollCooldownMul: number;
  groundSpeedMul: number;
  shieldRestorePerSec: number;
  missileBlind: boolean;
  primaryShotMul: number;
}

export interface ShipRec {
  mods: BuffMods;
  state: ShipState;
  /** Effective FrameDef of this Ship: the tuned Frame, with equipped gear laid over it. */
  fd: FrameDef;
  gear: ResolvedGear | null;
  body: RigidBody;
  collider: Collider;
  /** World-space velocity not along the nose (strafe, vertical, roll, momentum slip). Derivable from state. */
  lat: [number, number, number];
  fireCd: [number, number];
  shieldDelay: number;
  /** Secondary salvo in progress: volleys left, seconds to the next one, and its Target (server-only). */
  salvoLeft: number;
  salvoCd: number;
  salvoTarget: string | null;
  /** Seconds the Primary still holds fire after entering Siege; `wasSieged` detects the entry. */
  siegeArm: number;
  wasSieged: boolean;
  spawnCounter: number;
  /** Hits left on the absorbHits buff (Chaff Screen); set on cast, server-side. */
  absorbLeft: number;
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
  /** Visual-only round (Primary with no valid Target, or a missed roll): collides with nothing, deals nothing. */
  visual: boolean;
  /** Primary round that won its roll: deals its damage to this Target once it has flown `strikeAt` metres. */
  strike: string | null;
  strikeAt: number;
  /** Announced by missileIncoming: emits missileEnded when it goes. */
  warned: boolean;
  /** Downward acceleration (bombs); 0 for straight-flying projectiles. */
  gravity: number;
  /** Damage multiplier vs Grounded/Docked victims (ground-strike bombs). */
  groundMul: number;
  /** Current weave offset amplitude (m) already applied to the position. */
  weaveAmp: number;
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
