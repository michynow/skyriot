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
  /** Rising edge of the launch key (R): take off from a Launch Deck. */
  launch: boolean;
  /** Currently selected target (Tab). Missiles only lock onto this Ship. */
  target: ShipId | null;
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
  launch: false,
  target: null,
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
  /** Timed buffs currently on this Ship (own casts and ally auras). */
  buffs: ActiveBuff[];
  /** Active toggle Skill per toggleGroup, e.g. { bombing: 'ground-strike-mode' }. */
  toggles: Record<string, SkillId>;
  /** Rounds left for Primary / Secondary. Refilled on a Launch Deck. */
  ammo1: number;
  ammo2: number;
  /** Docked on a Launch Deck: stationary, resupplying, waits for `launch` input. */
  docked: boolean;
  /** Bulwark only: landed and driving on terrain; Siege Mode is only possible while grounded. */
  grounded: boolean;
  // Movement-affecting hidden state, kept in ShipState so reconciliation is exact.
  /** Smoothed angular velocity (rad/s, world space) of the nose turn. */
  angVel: Vec3;
  /** Brake was held last tick (Siege Mode toggles on the rising edge). */
  brakeHeld: boolean;
  dashTicks: number;
  ghostTicks: number;
  ironTicks: number;
  flareTicks: number;
  /** Ticks spent docked (resupply fires at DECK.resupplySec). */
  dockTicks: number;
  /** Siege skill used while airborne and fast: auto-brake until slow, then enter airborne Siege. */
  siegePending: boolean;
  /** Barrel Roll progress 0..1 (spin the model 360 degrees about its forward axis); -1 when not rolling. */
  rollPhase: number;
  /** -1 left / +1 right while rolling, else 0. */
  rollDir: number;
  /** Near or past the map edge: show "RETURN TO COMBAT AREA". Past the edge steering is overridden. */
  outOfBounds: boolean;
  // HUD values the client cannot derive exactly (server-computed).
  /** Distance (m) / time to impact (s) of the nearest guided missile homing on this Ship; -1 = none. */
  incomingDist: number;
  incomingTti: number;
  /** Secondary can currently lock the selected Target (cone from the nose, range, no flares). */
  canLock: boolean;
  /** Lock progress 0..1 toward `lockTarget`. */
  lockProgress: number;
  // Launch Queue: after death a Ship waits in its Base's hangar, then is staged in a Launch Tunnel and catapulted.
  /** 'none' = flying (or dead, waiting for respawn); see LaunchPhase. */
  launchPhase: LaunchPhase;
  /** Position in the Base's Launch Queue (0 = next out) while 'hangar', else -1. */
  queuePos: number;
  /** Launch Tunnel index while 'staging' | 'ready' | 'catapult', else -1. */
  tunnel: number;
  /** Ticks left in the current launch phase (staging countdown, catapult stroke). */
  launchTicks: number;
  /** Stalled: too slow to fly; nose drops and steering is weak until speed recovers. */
  stalled: boolean;
}

/**
 * hangar: waiting in the Launch Queue inside the Base (hidden, not targetable).
 * staging: platform carries the Ship onto the catapult, doors open, tunnel lights run outward.
 * ready: catapult charged; full throttle (W) fires it (Bots fire at once).
 * catapult: being thrown down the Launch Tunnel; ends in free flight ('none').
 */
export type LaunchPhase = 'none' | 'hangar' | 'staging' | 'ready' | 'catapult';

export type StructureId = string;
/** core: the Base itself (destroy = win). shieldStation: keeps the Core's shield dome up. turret: anti-air gun. */
export type StructureKind = 'core' | 'shieldStation' | 'turret';

export interface StructureState {
  id: StructureId;
  kind: StructureKind;
  nation: NationId;
  pos: Vec3;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Turret barrel direction (unit, world); [0,0,-1] for others. */
  aim: Vec3;
}

export interface MatchState {
  phase: 'battle' | 'ended';
  winner: NationId | null;
  /** While 'ended': tick the next battle starts (Bases rebuilt). */
  restartAtTick: number;
  /** Core shield dome is up (at least one Shield Station alive). */
  shielded: Record<NationId, boolean>;
  /** Launch Queue per Base, next out first. */
  queues: Record<NationId, ShipId[]>;
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
  | { type: 'skillUsed'; id: ShipId; skill: SkillId; slot: number; targets?: ShipId[] }
  | { type: 'barrelRoll'; id: ShipId; dir: -1 | 1 }
  | {
      type: 'terrainImpact';
      id: ShipId;
      damage: number;
      pos: Vec3;
      /** true = shield absorbed it and the Ship bounced; false = no shield, Ship destroyed. */
      bounced: boolean;
    }
  | {
      type: 'missileEvaded';
      id: number;
      victim: ShipId;
      reason: 'roll' | 'terrain' | 'flare' | 'purge' | 'lost';
    }
  | { type: 'teleport'; id: ShipId; pos: Vec3 }
  | { type: 'docked'; id: ShipId }
  | { type: 'resupplied'; id: ShipId }
  | { type: 'launched'; id: ShipId }
  | {
      type: 'structureHit';
      projectile: number;
      attacker: ShipId;
      structure: StructureId;
      damage: number;
      pos: Vec3;
      /** true = absorbed by the Core's shield dome (no damage). */
      shielded: boolean;
    }
  | { type: 'structureDestroyed'; structure: StructureId; killer: ShipId | null; pos: Vec3 }
  | { type: 'shieldDown'; nation: NationId }
  | { type: 'launchStaged'; id: ShipId; tunnel: number }
  | { type: 'catapult'; id: ShipId; tunnel: number }
  | { type: 'matchEnded'; winner: NationId }
  | { type: 'matchStarted' };

/** S→C at SNAPSHOT_HZ. */
export interface Snapshot {
  tick: number;
  serverTimeMs: number;
  /** Last PilotInput.seq the server applied for the receiving client. */
  ack: number;
  ships: ShipState[];
  /** Live missiles (sting/seeker) in radar range or homing on the receiver: their real, server-simulated path. */
  missiles: MissileSnapshot[];
  /** All Base structures (both Nations). */
  structures: StructureState[];
  match: MatchState;
}

export interface MissileSnapshot {
  id: number;
  pos: Vec3;
  vel: Vec3;
  /** Still homing on a target (false after roll/terrain/flare/purge broke guidance). */
  guided: boolean;
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
  /** Floating platforms where Ships Dock to resupply. */
  launchDecks: Record<NationId, LaunchDeck[]>;
  /** One Base per Nation: Launch Tunnels, Shield Stations, Turrets, Core. */
  bases: Record<NationId, BaseDef>;
}

export interface BaseDef {
  /** Core centre at ground level. Destroying the Core wins the battle for the other Nation. */
  core: Vec3;
  /** Unit horizontal direction the Base faces (toward the front); Launch Tunnels open this way. */
  facing: Vec3;
  /** Terrain is flattened to `core[1]` within this radius (m), blending out over the next 30%. */
  plateauRadius: number;
  tunnels: LaunchTunnel[];
  turrets: Vec3[];
  shieldStations: Vec3[];
  /** Shield dome radius around the Core (m). */
  shieldRadius: number;
}

export interface LaunchTunnel {
  /** Catapult start (Ship centre) inside the Base. */
  start: Vec3;
  /** Unit launch direction. */
  dir: Vec3;
  /** Tunnel length (m) from start to the exit doors. */
  length: number;
}

export interface LaunchDeck {
  /** Centre of the deck surface. */
  pos: Vec3;
  /** Deck surface radius (m). Ships slower than DECK.dockMaxSpeed inside it dock. */
  radius: number;
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
  ammo1Max: number;
  /** Radar and visibility range (m): enemies beyond it aren't shown or sent to this Pilot. */
  radarRangeM: number;
  ammo2Max: number;
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
  kind: 'consumable' | 'skill' | 'buff' | 'toggle';
  /** For 'buff': stat changes while active (durationSec). Applied to self, or to allies in `auraRadiusM`. */
  buff?: BuffEffect;
  /** Buff also/only applies to allies within this radius (self included). */
  auraRadiusM?: number;
  /** For 'toggle': Skills sharing a group are mutually exclusive modes (e.g. Anvil bombing modes). */
  toggleGroup?: string;
}

/** Multipliers default to 1, additions to 0. */
export interface BuffEffect {
  fireRateMul?: number;
  speedMul?: number;
  turnRateMul?: number;
  deflectAdd?: number; // may exceed the normal Deflect cap
  damageMul?: number;
  damageTakenMul?: number;
  maxHpMul?: number;
  shieldRegenMul?: number;
  fuelRegenMul?: number;
  lockTimeMul?: number;
  splashMul?: number;
}

export interface ActiveBuff {
  skill: SkillId;
  /** Ship that cast it (aura buffs on allies). */
  source: ShipId;
  ticksLeft: number;
}

// ---- Wire ----

export const MSG = {
  input: 'input', // C→S PilotInput
  chat: 'chat', // C→S ChatMessage
  welcome: 'welcome', // S→C Welcome
  snapshot: 'snapshot', // S→C Snapshot
  events: 'events', // S→C SimEvent[]
  console: 'console', // S→C { text: string } dev command replies
} as const;

export interface JoinOptions {
  mapId: MapId;
  nation: NationId;
  frame: FrameId;
  name: string;
}

export interface Welcome {
  shipId: ShipId;
  mapId: MapId;
  tick: number;
  serverTimeMs: number;
  dev: boolean;
}
