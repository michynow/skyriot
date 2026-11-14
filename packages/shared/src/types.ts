// Shared contracts. Owned by the orchestrator — change only by agreement (see docs/ARCHITECTURE.md §7).

export const TICK_HZ = 30;
export const TICK_DT = 1 / TICK_HZ;
export const SNAPSHOT_HZ = 20;
export const MAX_SHIPS_PER_INSTANCE = 60;
export const BOTS_PER_NATION = 5;
/**
 * Max target rewind (shooter's view tick to the tick its input runs). That is the round trip + server
 * jitter buffer + 100 ms interpolation delay: ~500 ms at 150 ms each way, plus jitter headroom.
 */
export const LAG_COMP_MAX_MS = 600;

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
  /** Rising edge of the launch key (Space): take off from a Launch Deck or fire the catapult. */
  launch: boolean;
  /** Rising edge of a confirmed B: toggle a mid-air halt (Ship stops in place to inspect its Loadout). */
  halt: boolean;
  /** Rising edge of C: land (Bulwark: onto the terrain below, or lift off when grounded; others: nearest own Launch Deck). */
  land: boolean;
  /**
   * Selected Target (hover when none, Shift switches): a Ship or structure id. The server accepts it only if it
   * exists, is hostile, visible and inside the Frame's STD or ADV radar range; otherwise it counts as none.
   */
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
  halt: false,
  land: false,
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
  /** Equipped Cosmetic (paint + trail), visual only. */
  cosmetic?: CosmeticId;
}

export interface ShipState {
  id: ShipId;
  nation: NationId;
  frame: FrameId;
  name: string;
  isBot: boolean;
  tier: number;
  upgrade: number;
  /** Equipped Cosmetic, '' = stock paint. Seen by all clients; zero stats. */
  cosmetic: CosmeticId | '';
  pos: Vec3;
  rot: Quat;
  vel: Vec3;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  fuel: number; // 0..1
  /** Skill energy: every Skill cast spends its `spCost`; regenerates, refilled on a Launch Deck. Max = FrameDef.maxSp. */
  sp: number;
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
  /** Secondary can currently lock the selected Target (cone from the nose, range). */
  canLock: boolean;
  /** Lock progress 0..1 toward `lockTarget`. */
  lockProgress: number;
  /** Siege Mode gun lock: the Primary auto-tracks this Target until it leaves the break cone, range or sight. */
  siegeLock: ShipId | null;
  /** Primary (STD) heat 0..1 from continuous fire; at 1 the gun is overheated until it cools. */
  heat: number;
  overheated: boolean;
  /** Seconds until the Secondary (ADV) can fire again (reattack counted from the end of the last salvo). */
  advReadyIn: number;
  // Launch Queue: after death a Ship waits in its Base's hangar, then is staged in a Launch Tunnel and catapulted.
  /** 'none' = flying (or dead, waiting for respawn); see LaunchPhase. */
  launchPhase: LaunchPhase;
  /** Position in the Base's Launch Queue (0 = next out) while 'hangar', else -1. */
  queuePos: number;
  /** Launch Tunnel index while 'staging' | 'ready' | 'catapult', else -1. */
  tunnel: number;
  /** Ticks left in the current launch phase (staging countdown, catapult stroke). */
  launchTicks: number;
  /** Ticks left of a Pivot Flip (fast 180-degree turn; turn rate is boosted). */
  flipTicks: number;
  /** Ticks left of a Backdraft (burst flying backwards, nose held). */
  reverseTicks: number;
  /** Halted mid-air (B + confirm): engine off, frozen in place, weapons cold, until throttle/boost or B again. */
  halted: boolean;
  /** Landing autopilot (C): flying onto the nearest own Launch Deck, or (Bulwark) down onto the terrain. */
  landing: boolean;
  /** Ticks left of the Bulwark's lift-off climb (C while Grounded). */
  liftTicks: number;
  /** Ticks since the booster lit (0 = off). A tap still burns for BOOST_MIN_SEC. */
  boostTicks: number;
  /** Booster spool 0..1: rises over BOOST_SPOOL_SEC when lit, bleeds over BOOST_BLEED_SEC after. Drives speed and FX. */
  boostRamp: number;
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

export type ProjectileKind = 'tracer' | 'missile' | 'rocket' | 'shell';

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
      reason: 'roll' | 'terrain' | 'purge' | 'lost';
    }
  /** A Secondary volley was fired at this Ship (start the missile siren). One per volley. */
  | {
      type: 'missileIncoming';
      attacker: ShipId;
      target: ShipId;
      weapon: WeaponId;
      missiles: number[];
    }
  /** A projectile announced by missileIncoming is gone: hit = burst on/near a Ship, impact = terrain/structure. */
  | { type: 'missileEnded'; id: number; reason: 'hit' | 'impact' | 'expired' }
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
  /** Still homing on a target (false after roll/terrain/purge broke guidance). */
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
  /** One Base per Nation: Launch Tunnels, Shield Stations, Turrets, Core. Absent on Cities. */
  bases?: Record<NationId, BaseDef>;
  /** City: safe zone (no damage), hosts the shop/hangar; owned by this Nation. */
  city?: NationId;
  gates?: GateDef[];
  /** City only: its own ground and the buildings Ships collide with. */
  layout?: CityLayout;
}

/** Which Window a City building serves (its key works anywhere in the City; the building just shows the prompt). */
export type CityService = 'vendor' | 'hangar' | 'charms';

/** One solid City building. Collider = box (or upright cylinder) over its footprint, base at `pos`. */
export interface CityBlock {
  /** Look selector for the client builder (e.g. 'gild-tower', 'crane'). */
  kind: string;
  /** Centre of the footprint at the base (m). */
  pos: Vec3;
  /** Width (x), height (y), depth (z) before yaw; a cylinder uses size[0] as diameter. */
  size: Vec3;
  /** Rotation about +Y (radians). */
  yaw?: number;
  shape?: 'box' | 'cyl';
  /** false: drawn but not collided with (thin props). Default solid. */
  solid?: boolean;
  service?: CityService;
}

export interface CityLayout {
  /** Heightfield generator: Gildspire's mesa above a cloud sea, Rivet Harbor's quay and bay. */
  ground: 'sky-mesa' | 'harbour';
  blocks: CityBlock[];
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

export type EngineId = string;

/** An engine part: sets a Frame's speed envelope and handling. Throttle spans minSpeed..maxSpeed. */
export interface EngineDef {
  id: EngineId;
  name: string;
  minSpeed: number;
  cruiseSpeed: number;
  maxSpeed: number;
  boostSpeed: number;
  accel: number; // m/s² toward throttle target
  /** Max angular rate toward aim (rad/s). */
  turnRate: number;
  /** Turn-rate multiplier while boosting (<1: wider turn). */
  boostTurnMul: number;
}

/** Engine stats are resolved onto the Frame (from its equipped `engine`) so the sim reads one record. */
export interface FrameDef extends Omit<EngineDef, 'id' | 'name'> {
  id: FrameId;
  name: string;
  role: string;
  engine: EngineId;
  maxHp: number;
  maxShield: number;
  shieldRegenPerSec: number;
  shieldRegenDelaySec: number;
  /** Skill energy pool and its regeneration (per second). */
  maxSp: number;
  spRegenPerSec: number;
  strafeSpeed: number;
  verticalSpeed: number;
  /** Time constant (s) of strafe/vertical velocity blending (strafe/vertical onset). */
  lateralTauSec: number;
  /** Momentum: with no strafe/vertical input, sideways slip from turning bleeds off with this time constant (s). */
  slipTauSec: number;
  fuelBurnPerSec: number; // fraction of tank
  fuelRegenPerSec: number;
  rollImpulse: number; // m/s lateral burst
  rollInvulnSec: number;
  rollCooldownSec: number;
  deflectChance: number; // 0..0.15
  ammo1Max: number;
  /** Radar and visibility range (m): enemies beyond it aren't shown or sent to this Pilot. */
  radarRangeM: number;
  /** STD radar (m): the Primary damages the Target only inside it. ADV radar (m): Secondary lock range. */
  radarStdM: number;
  radarAdvM: number;
  ammo2Max: number;
  /** Capsule radius & half-height for hit tests and terrain collision. */
  radius: number;
  halfLength: number;
  canHover: boolean;
  /** Defence: fraction of incoming damage removed (cap 0.3); 0 when absent. Set by Armor. */
  defence?: number;
  primary: WeaponId;
  secondary: WeaponId;
  /**
   * Default hotbar layout only: HOTBAR_BARS bars of HOTBAR_BAR_SLOTS slots, flattened; null = empty. A Pilot's own
   * layout lives in `Loadout.hotbar`; Bots always fly this one. The Frame's full kit is every SKILLS entry listing it (or 'all').
   */
  hotbar: (SkillId | null)[];
}

/** Secondary visuals only (client fx); no sim effect. `color` is HDR rgb of flame/trail. */
export interface WeaponLook {
  trail: 'thin' | 'billow' | 'ion' | 'spiral' | 'arc';
  warhead: 'dart' | 'fat' | 'bomb' | 'pod' | 'shell';
  blast: 'flash' | 'fireball' | 'shrapnel' | 'plume';
  color: [number, number, number];
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
  /** Homing turn rate rad/s; 0 = dumb. Derived from inductionDegPerSec. */
  homingTurnRate: number;
  /** Legacy lock cone (rad) = validAngleDeg in radians; lockTimeSec is always 0 (locks are instant). */
  lockConeRad: number;
  lockTimeSec: number;
  splashRadius: number;
  /** Primary: per-round hit chance (0..1) against the selected Target inside STD radar range. */
  accuracy: number;
  /** Rounds per trigger: `count` at once, `series` volleys in a row (Secondary only; Primary fires count x 1). */
  pattern: { count: number; series: number };
  /** Primary: seconds of continuous fire until overheated; 0 = never overheats. */
  overheatSec: number;
  /** Secondary: half-angle (deg) from the nose inside which the Target is LOCKED; 0 = lockless (bombs). */
  validAngleDeg: number;
  /** Secondary: guided turn rate (deg/s); 0 = flies straight. */
  inductionDegPerSec: number;
  /** Secondary only: how the projectile and its blast look. */
  look?: WeaponLook;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  frames: FrameId[] | 'all';
  cooldownSec: number;
  durationSec: number;
  /** SP spent per cast (0 = free: Consumables, toggles). */
  spCost: number;
  kind: 'consumable' | 'skill' | 'buff' | 'toggle';
  /**
   * For 'buff': stat changes while active (durationSec). Applied to self, or to allies in `auraRadiusM`.
   * For a 'skill' that debuffs enemies: the effect its victims carry (the cast picks who).
   */
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
  /** Legacy, unused: locks are instant. */
  lockTimeMul?: number;
  /** Primary accuracy (hit chance) added, e.g. 0.1 = +10 points. */
  accuracyAdd?: number;
  splashMul?: number;
  /** Heal-over-time: fraction of max HP restored per second. */
  hpRegenPerSec?: number;
  /** Stealth: hidden from enemy radar beyond CLOAK_REVEAL_M and can't be locked; firing ends it. */
  cloak?: boolean;
  /** Damage aura: enemies within DAMAGE_AURA_RADIUS of the holder take this much damage per second. */
  damageAuraDps?: number;
  /** Extra missiles per Secondary salvo. */
  salvoAdd?: number;
  /** Primary / Secondary damage only (on top of damageMul). */
  primaryDamageMul?: number;
  secondaryDamageMul?: number;
  /** Secondary refire rate (fireRateMul is Primary only). */
  secondaryFireRateMul?: number;
  /** Primary spread (accuracy). */
  spreadMul?: number;
  /** Secondary lock cone. */
  lockConeMul?: number;
  /** Damage that lands on the shield (the part the shield absorbs). */
  shieldDamageTakenMul?: number;
  /** Damage from Secondary weapons (missiles, rockets, bombs, shells); 0 = immune. */
  secondaryDamageTakenMul?: number;
  /** Terrain impact HP loss. */
  collisionDamageMul?: number;
  /** Takes no damage at all. */
  invulnerable?: boolean;
  /** Can't fire either weapon. */
  noAttack?: boolean;
  /** Barrel Roll cooldown; 0 = rolls back to back. */
  rollCooldownMul?: number;
  /** Speed while Grounded (driving on terrain). */
  groundSpeedMul?: number;
  /** Shield restored per second, as a fraction of max shield. */
  shieldRestorePerSec?: number;
  /** Debuff: no incoming-missile warning, and Barrel Rolls don't break missile guidance. */
  missileBlind?: boolean;
  /** Armed shot: the next Primary round deals this many times damage, flies twice as far, no spread; then the buff ends. */
  primaryShotMul?: number;
  /** Decoys: the next N projectile hits are absorbed whole; the buff ends when they're used up. */
  absorbHits?: number;
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
  profile: 'profile', // S→C PilotProfile (on join and after every economy change)
  buy: 'buy', // C→S BuyRequest (city only)
  upgrade: 'upgrade', // C→S UpgradeRequest (city only)
  equip: 'equip', // C→S EquipRequest (combat gear: city or Docked; charms/cosmetic: anywhere)
  sell: 'sell', // C→S SellRequest (city only): SELL_RATE of the Credits price
  discard: 'discard', // C→S SellRequest: destroy the item (count from a stack), no refund
  moveItem: 'moveItem', // C→S MoveItemRequest: move within the Bag (swap if occupied)
  hotbar: 'hotbar', // C→S HotbarRequest: the Pilot's own hotbar layout for a Frame
  chooseMod: 'chooseMod', // C→S ChooseModRequest: pick one of the three offered Mods, once
  travel: 'travel', // S→C TravelOrder: leave this room, join `mapId`
} as const;

export interface JoinOptions {
  mapId: MapId;
  nation: NationId;
  frame: FrameId;
  name: string;
  /** Session token from the auth endpoint; absent = guest (profile not persisted). */
  token?: string;
  /** Signed travel token when arriving through a Gate. */
  travel?: string;
}

// ---- Economy (M2) ----

export type ItemKind =
  'weapon' | 'engine' | 'armor' | 'radar' | 'cosmetic' | 'charm' | 'consumable';
/** Sets how many Mods an item carries (0 / 1 / 2 / 3 / 3 + Relic Mod); base stats don't change. */
export type Rarity = 'standard' | 'tuned' | 'custom' | 'prototype' | 'relic';
export type ArmorId = string;
export type RadarId = string;
export type CharmId = string;
export type CosmeticId = string;
/** Any ownable def; Consumables are SkillIds (they live in SKILLS too). */
export type ItemDefId = WeaponId | EngineId | ArmorId | RadarId | CharmId | CosmeticId | SkillId;
export type ItemId = string;

/** What an item is (content, static). The kind's stats live in WEAPONS / ENGINES / ARMORS / RADARS / CHARMS / COSMETICS / SKILLS. */
export interface ItemDef {
  id: ItemDefId;
  kind: ItemKind;
  name: string;
  tier: number;
  levelReq: number;
  /** Frame it fits (armor, engine, radar); absent = any. Weapons keep using fitsSlot. */
  frame?: FrameId;
  /** Icon registry key; defaults to id. */
  icon?: string;
  flavor?: string;
  /** Shop price; 0 = not sold for Credits (drops, rewards). */
  credits: number;
  /** Max per bag cell; 1 = doesn't stack. */
  stack: number;
}

/** Armor: sets a Frame's hull numbers. Tier 1 of each line = the Frame's stock values. */
export interface ArmorDef {
  id: ArmorId;
  maxHp: number;
  maxShield: number;
  shieldRegenPerSec: number;
  /** Fraction of incoming damage removed (cap 0.3). */
  defence: number;
  /** Added to the Frame's Deflect chance (still capped 0.15). */
  deflectAdd?: number;
}

/** Radar: sets a Frame's sensor ranges (absolute metres). Tier 1 of each line = the Frame's stock values. */
export interface RadarDef {
  id: RadarId;
  radarStdM: number;
  radarAdvM: number;
  radarRangeM: number;
  /** Degrees added to the Secondary's Valid Angle. */
  validAngleAdd?: number;
}

export interface CharmDef {
  id: CharmId;
  /** Logged-in hours after activation. */
  hours: number;
  effect: CharmEffect;
}

/** `*Pct` are whole percent (10 = +10%); `defenceAdd` is a fraction like `ArmorDef.defence`. Same field doesn't stack: the higher wins. */
export interface CharmEffect {
  xpPct?: number;
  creditsPct?: number;
  scrapPct?: number;
  gloryPct?: number;
  primaryDamagePct?: number;
  secondaryDamagePct?: number;
  defenceAdd?: number;
}

/** Visual only: paint scheme and trail colour on the Ship model. Zero stats, ever. */
export interface CosmeticDef {
  id: CosmeticId;
  /** CSS hex colour. */
  paint: string;
  trail: string;
}

/** One Mod line. Value at tier t = base + perTier * (t - 1) (`modValue`). `*Pct` whole percent; `*Add` in the stat's own unit. */
export interface ModDef {
  id: string;
  kind: ItemKind;
  label: string;
  /** Value at tier 1. */
  base: number;
  perTier: number;
  stat: ModStat;
}

export type ModStat =
  | 'damagePct'
  | 'fireRatePct'
  | 'projectileSpeedPct'
  | 'accuracyAdd'
  | 'validAngleAdd'
  | 'ammoPct'
  | 'maxSpeedPct'
  | 'boostSpeedPct'
  | 'turnRatePct'
  | 'fuelBurnPct'
  | 'hpPct'
  | 'shieldPct'
  | 'shieldRegenPct'
  | 'defenceAdd'
  | 'deflectAdd'
  | 'stdRangePct'
  | 'advRangePct';

/** One owned thing. Upgrade +0..+10 never fails (ADR 0004). */
export interface ItemInstance {
  id: ItemId;
  def: ItemDefId;
  kind: ItemKind;
  upgrade: number;
  /** Absent = 'standard'. */
  rarity?: Rarity;
  /** One entry per Mod slot: the chosen Mod id, or the three offered ids until the Pilot picks. */
  mods?: (string | [string, string, string])[];
  /** Stack size (Consumables); absent = 1. */
  count?: number;
  /** Charm: logged-in ms left after activation; absent = not activated yet. */
  msLeft?: number;
  /** Bag cell 0..BAG_SIZE-1; null/absent while equipped. */
  bag?: number | null;
}

export interface Wallet {
  credits: number;
  scrap: number;
  glory: number;
}

/** Equipped item per slot; absent = the Frame's stock part. */
export interface Loadout {
  primary?: ItemId;
  secondary?: ItemId;
  engine?: ItemId;
  armor?: ItemId;
  radar?: ItemId;
  cosmetic?: ItemId;
  /** HOTBAR_BARS × HOTBAR_BAR_SLOTS Skill / Consumable ids; absent = the Frame's default FrameDef.hotbar. */
  hotbar?: (SkillId | null)[];
}

/** Per-Frame equipment slots. */
export type GearSlot = Exclude<keyof Loadout, 'hotbar'>;
/** Every slot an EquipRequest can target: the Frame's gear plus the Pilot-wide Charm slots I–III. */
export type EquipSlot = GearSlot | 'charm0' | 'charm1' | 'charm2';

/** What the server tells a Pilot about themselves. Server is the only writer. */
export interface PilotProfile {
  name: string;
  nation: NationId;
  level: number;
  xp: number;
  wallet: Wallet;
  items: ItemInstance[];
  /** Per Frame. */
  loadouts: Partial<Record<FrameId, Loadout>>;
  /** Pilot-wide Charm slots I–III (length 3); null = empty. Slots unlock at CHARM_SLOT_LEVELS. */
  charms: (ItemId | null)[];
  guest: boolean;
}

export interface BuyRequest {
  def: ItemDefId;
}
export interface UpgradeRequest {
  item: ItemId;
}
export interface EquipRequest {
  /** Ignored for charm slots. */
  frame: FrameId;
  slot: EquipSlot;
  /** null = back to stock / empty. */
  item: ItemId | null;
}
/** Sell (MSG.sell) or discard (MSG.discard) an item; `count` from a stack, absent = all of it. */
export interface SellRequest {
  item: ItemId;
  count?: number;
}
/** Move an item to a Bag cell; swaps with the occupant. (Split stacks later.) */
export interface MoveItemRequest {
  item: ItemId;
  bag: number;
}
/** The Pilot's hotbar layout for `frame`, HOTBAR_BARS × HOTBAR_BAR_SLOTS long. */
export interface HotbarRequest {
  frame: FrameId;
  slots: (SkillId | null)[];
}
/** Pick `mod` (one of the three offered) for Mod slot `slot` of `item`. */
export interface ChooseModRequest {
  item: ItemId;
  slot: number;
  mod: string;
}
export interface TravelOrder {
  mapId: MapId;
  travel: string;
}

/** A shop listing; cities sell every unlocked tier. */
export interface ShopEntry {
  def: ItemDefId;
  kind: ItemKind;
  tier: number;
  credits: number;
}

/** Map-to-map portal. Flying into it sends a TravelOrder. */
export interface GateDef {
  pos: Vec3;
  radius: number;
  to: MapId;
}

export interface Welcome {
  shipId: ShipId;
  mapId: MapId;
  tick: number;
  serverTimeMs: number;
  dev: boolean;
}
