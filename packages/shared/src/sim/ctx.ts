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
  NationId,
  ProjectileKind,
  ShipId,
  ShipState,
  SimEvent,
} from '../types';
import type { SimTuning } from './index';

export interface ShipRec {
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
}

export interface Wall {
  x: number;
  y: number;
  z: number;
  nation: NationId;
  expireTick: number;
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
}
