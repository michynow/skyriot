// Shared contracts. Owned by the orchestrator — change only by agreement (see docs/ARCHITECTURE.md §7).

export const TICK_HZ = 30;
export const TICK_DT = 1 / TICK_HZ;
export const SNAPSHOT_HZ = 20;
export const MAX_SHIPS_PER_INSTANCE = 60;
export const BOTS_PER_NATION = 20;
export const LAG_COMP_MAX_MS = 200;

export type Vec3 = [number, number, number];
/** Quaternion x, y, z, w */
export type Quat = [number, number, number, number];

export type ShipId = string;
export type NationId = 'concord' | 'vex';
export type FrameId = 'wasp' | 'anvil' | 'halo' | 'bulwark';
export type WeaponId = string;
export type SkillId = string;
export type MapId = string;

/** One client tick of intent. Sent C→S at TICK_HZ. All axes clamped to [-1, 1] server-side. */
export interface PilotInput {
  seq: number;
  /** Unit vector in world space toward the aim cursor. */
  aim: Vec3;
  throttle: number; // -1 slow down .. +1 speed up
  strafe: number; // -1 left .. +1 right
  vertical: number; // -1 down (Q) .. +1 up (E)
  boost: boolean;
  brake: boolean; // Space: hover/brake; Bulwark: toggles Siege Mode on rising edge
  fire1: boolean;
  fire2: boolean;
  /** Hotbar slot pressed this tick (0-9), or -1. */
  hotbar: number;
  /** True on the tick a double-tap A / D was detected. */
  rollLeft: boolean;
  rollRight: boolean;
  /** Client's estimate of server tick it is viewing remotes at (for lag compensation). */
  viewTick: number;
}

export const EMPTY_INPUT: Omit<PilotInput, 'seq' | 'viewTick'> = {
  aim: [0, 0, -1],
  throttle: 0,
  strafe: 0,
  vertical: 0,
  boost: false,
  brake: false,
  fire1: false,
  fire2: false,
  hotbar: -1,
  rollLeft: false,
  rollRight: false,
};

export interface ShipSpawn {
  nation: NationId;
  frame: FrameId;
  name: string;
  isBot: boolean;
  /** Visual only for M1. */
  tier: number;
  upgrade: number;
}

export interface ShipState {
  id: ShipId;
  nation: NationId;
  frame: FrameId;
  name: string;
  isBot: boolean;
  tier: number;
  upgrade: number;
  pos: Vec3;
  rot: Quat;
  vel: Vec3;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  fuel: number; // 0..1
  speed: number; // current forward speed m/s
  alive: boolean;
  respawnAtTick: number;
  /** Ticks remaining of Barrel Roll invulnerability (0 = none). */
  rollTicks: number;
  rollCooldownTicks: number;
  sieged: boolean;
  /** Per hotbar slot, ticks until ready. */
  cooldowns: number[];
  /** Missile lock target, if any. */
  lockTarget: ShipId | null;
}

export type ProjectileKind = 'tracer' | 'missile' | 'rocket' | 'shell' | 'flare';

export type SimEvent =
  | {
      type: 'projectileSpawned';
      id: number;
      owner: ShipId;
      kind: ProjectileKind;
      weapon: WeaponId;
      origin: Vec3;
      dir: Vec3;
      speed: number;
      target: ShipId | null;
      tick: number;
    }
  | { type: 'projectileExpired'; id: number; pos: Vec3 }
  | {
      type: 'hit';
      projectile: number;
      attacker: ShipId;
      victim: ShipId;
      damage: number;
      deflected: boolean;
      pos: Vec3;
    }
  | { type: 'shipDestroyed'; victim: ShipId; killer: ShipId | null; pos: Vec3 }
  | { type: 'shipRespawned'; id: ShipId; pos: Vec3 }
  | { type: 'skillUsed'; id: ShipId; skill: SkillId; slot: number }
  | { type: 'barrelRoll'; id: ShipId; dir: -1 | 1 }
  | { type: 'terrainImpact'; id: ShipId; damage: number; pos: Vec3 };

/** S→C at SNAPSHOT_HZ. */
export interface Snapshot {
  tick: number;
  serverTimeMs: number;
  /** Last PilotInput.seq the server applied for the receiving client. */
  ack: number;
  ships: ShipState[];
}

/** C→S chat line; lines starting with '/' are dev commands. */
export interface ChatMessage {
  text: string;
}

// ---- Content definitions ----

export interface EnvironmentProfile {
  kind: 'atmosphere' | 'space';
  gravity: number; // m/s² downward; 0 in space
  /** Minimum forward speed before stalling (atmosphere). 0 = no stall. */
  stallSpeed: number;
  /** Bulwark hover/siege attaches to terrain (atmosphere) or any static hull (space). */
  groundMode: 'terrain' | 'hull';
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sky: 'desert-dusk' | 'storm' | 'space-nebula';
}

export interface MapDef {
  id: MapId;
  name: string;
  seed: number;
  /** Terrain square side in metres, centred at origin. */
  size: number;
  /** Heightfield resolution (samples per side). */
  resolution: number;
  maxHeight: number;
  env: EnvironmentProfile;
  spawns: Record<NationId, Vec3[]>;
  /** Hard ceiling; ships above are pushed down. */
  ceiling: number;
}

export interface FrameDef {
  id: FrameId;
  name: string;
  role: string;
  maxHp: number;
  maxShield: number;
  shieldRegenPerSec: number;
  shieldRegenDelaySec: number;
  minSpeed: number;
  cruiseSpeed: number;
  maxSpeed: number;
  boostSpeed: number;
  accel: number; // m/s² toward throttle target
  /** Max angular rate toward aim (rad/s). */
  turnRate: number;
  strafeSpeed: number;
  verticalSpeed: number;
  fuelBurnPerSec: number; // fraction of tank
  fuelRegenPerSec: number;
  rollImpulse: number; // m/s lateral burst
  rollInvulnSec: number;
  rollCooldownSec: number;
  rollFuelCost: number;
  deflectChance: number; // 0..0.15
  /** Capsule radius & half-height for hit tests and terrain collision. */
  radius: number;
  halfLength: number;
  canHover: boolean;
  primary: WeaponId;
  secondary: WeaponId;
  /** Default hotbar, 10 entries; null = empty. */
  hotbar: (SkillId | null)[];
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  kind: ProjectileKind;
  damage: number;
  fireIntervalSec: number;
  speed: number;
  rangeM: number;
  /** Cone half-angle (rad) of random spread. */
  spread: number;
  /** Homing turn rate rad/s; 0 = dumb. */
  homingTurnRate: number;
  /** Lock-on cone half-angle (rad) and time to lock; missiles only. */
  lockConeRad: number;
  lockTimeSec: number;
  splashRadius: number;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  frames: FrameId[] | 'all';
  cooldownSec: number;
  durationSec: number;
  kind: 'consumable' | 'skill';
}
