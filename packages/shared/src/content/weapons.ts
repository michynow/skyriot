import type { SkillDef, WeaponDef } from '../types';

export const WEAPONS: Record<string, WeaponDef> = {
  'needle-cannon': w('needle-cannon', 'Needle Cannon', 'tracer', 28, 0.08, 900, 1100, 0.012),
  'flak-repeater': w('flak-repeater', 'Flak Repeater', 'tracer', 55, 0.18, 650, 800, 0.03, {
    splashRadius: 4,
  }),
  'pulse-blaster': w('pulse-blaster', 'Pulse Blaster', 'tracer', 34, 0.11, 800, 950, 0.015),
  'twin-autocannon': w('twin-autocannon', 'Twin Autocannon', 'tracer', 48, 0.12, 750, 1000, 0.02),
  'sting-missile': w('sting-missile', 'Sting Missile', 'missile', 480, 1.6, 250, 1500, 0, {
    homingTurnRate: 2.4,
    lockConeRad: 0.45,
    lockTimeSec: 1.2,
    splashRadius: 5,
  }),
  'seeker-pod': w('seeker-pod', 'Seeker Pod', 'missile', 340, 1.6, 240, 1300, 0, {
    homingTurnRate: 2.5,
    lockConeRad: 0.5,
    lockTimeSec: 1,
    splashRadius: 5,
  }),
  'brick-bomb': w('brick-bomb', 'Brick Bomb', 'rocket', 520, 3.0, 140, 900, 0.01, {
    splashRadius: 14,
  }),
  'mortar-battery': w('mortar-battery', 'Mortar Battery', 'shell', 380, 2.6, 220, 1600, 0.02, {
    splashRadius: 10,
  }),
  // Base Turret gun (not a Frame weapon).
  'turret-flak': w('turret-flak', 'Turret Flak', 'tracer', 24, 0.2, 700, 950, 0.02, {
    splashRadius: 5,
  }),
};

export const SKILLS: Record<string, SkillDef> = {
  // ---- Core Frame kits: long buffs (minutes), modes ----
  overdrive: b(
    'overdrive',
    'Overdrive',
    'Frenzy: +35% Primary fire rate, +12% speed.',
    ['wasp'],
    240,
    90,
    {
      fireRateMul: 1.35,
      speedMul: 1.12,
    },
  ),
  'air-barrage-mode': t(
    'air-barrage-mode',
    'Air Barrage Mode',
    'Bombing mode: Secondary fires a forward salvo of 3 rockets at air targets.',
    ['anvil'],
    'bombing',
  ),
  'ground-strike-mode': t(
    'ground-strike-mode',
    'Ground Strike Mode',
    'Bombing mode: Secondary drops heavy bombs straight down, +40% damage vs Grounded/Docked targets and splash.',
    ['anvil'],
    'bombing',
  ),
  'rally-field': b(
    'rally-field',
    'Rally Field',
    'Allies within 150 m deal +15% damage.',
    ['halo'],
    240,
    120,
    { damageMul: 1.15 },
    150,
  ),
  purge: s(
    'purge',
    'Purge',
    'Break every missile lock on you and allies within 120 m.',
    ['halo'],
    45,
    0.5,
  ),
  flares: s(
    'flares',
    'Flares',
    'Dump hot decoys. Breaks all missile locks on you.',
    'all',
    14,
    0.5,
  ),
  'afterburn-dash': s(
    'afterburn-dash',
    'Afterburn Dash',
    'Instant boost burst, no fuel cost.',
    ['wasp'],
    10,
    1.5,
  ),
  'siege-anchor': s(
    'siege-anchor',
    'Siege Anchor',
    'Toggle Siege Mode: root in place, first-person gunner view, Target lock. Stronger when grounded.',
    ['bulwark'],
    1,
    0,
  ),
  'pivot-flip': s(
    'pivot-flip',
    'Pivot Flip',
    'Snap the nose around 180 degrees, keeping your speed.',
    'all',
    12,
    0.7,
  ),
  backdraft: s(
    'backdraft',
    'Backdraft',
    'Reverse thrusters: burst backwards for a moment, guns still facing forward.',
    'all',
    10,
    0.8,
  ),
  // ---- Wasp: stealth, burst fire, single-target snare ----
  'shroud-veil': b(
    'shroud-veil',
    'Shroud Veil',
    'Stealth: vanish from enemy radar beyond 180 m and refuse missile locks. Firing drops the veil.',
    ['wasp'],
    38,
    7,
    { cloak: true },
  ),
  'hot-barrels': b(
    'hot-barrels',
    'Hot Barrels',
    'Short burst: +55% Primary fire rate, -10% turn rate.',
    ['wasp'],
    26,
    6,
    { fireRateMul: 1.55, turnRateMul: 0.9 },
  ),
  'snare-tag': d(
    'snare-tag',
    'Snare Tag',
    'Tag the nearest enemy ahead (450 m): -30% speed, -35% turn rate.',
    ['wasp'],
    28,
    4.5,
    { speedMul: 0.7, turnRateMul: 0.65 },
  ),
  // ---- Anvil: area denial, payload, charge ----
  'cinder-cloud': s(
    'cinder-cloud',
    'Cinder Cloud',
    'Leave a burning cloud where you are: enemies inside take 80 damage per second.',
    ['anvil'],
    36,
    8,
  ),
  'heavy-payload': b(
    'heavy-payload',
    'Heavy Payload',
    'All weapons +30% damage and +20% splash, Primary fires 15% slower.',
    ['anvil'],
    45,
    10,
    { damageMul: 1.3, splashMul: 1.2, fireRateMul: 0.85 },
  ),
  'ram-surge': b(
    'ram-surge',
    'Ram Surge',
    'Engines to the stops: +35% speed and 15% less damage taken.',
    ['anvil'],
    30,
    5,
    { speedMul: 1.35, damageTakenMul: 0.85 },
  ),
  // ---- Halo: heal-over-time, defense aura, weaken ----
  'renewal-pulse': b(
    'renewal-pulse',
    'Renewal Pulse',
    'Allies within 110 m regain 3.5% max HP per second.',
    ['halo'],
    34,
    8,
    { hpRegenPerSec: 0.035 },
    110,
  ),
  'ward-lattice': b(
    'ward-lattice',
    'Ward Lattice',
    'Allies within 100 m: +12% Deflect (ignores cap), 10% less damage taken.',
    ['halo'],
    55,
    12,
    { deflectAdd: 0.12, damageTakenMul: 0.9 },
    100,
  ),
  'sapping-hex': d(
    'sapping-hex',
    'Sapping Hex',
    'Enemies within 140 m deal 20% less damage and fly 15% slower.',
    ['halo'],
    42,
    6,
    { damageMul: 0.8, speedMul: 0.85 },
  ),
  // ---- Bulwark: shock shell, damage aura, mobility, team defense ----
  'quake-round': d(
    'quake-round',
    'Quake Round',
    'Burst a shock charge 140 m ahead: 150 damage and a heavy slow to enemies within 60 m.',
    ['bulwark'],
    30,
    4,
    { speedMul: 0.6, turnRateMul: 0.7 },
  ),
  'shrapnel-ring': b(
    'shrapnel-ring',
    'Shrapnel Ring',
    'Spin a ring of shrapnel around the hull: enemies within 55 m take 60 damage per second.',
    ['bulwark'],
    40,
    8,
    { damageAuraDps: 60 },
  ),
  'servo-overclock': b(
    'servo-overclock',
    'Servo Overclock',
    'Overclock the drive: +25% speed, +25% turn rate.',
    ['bulwark'],
    32,
    8,
    { speedMul: 1.25, turnRateMul: 1.25 },
  ),
  'bastion-field': b(
    'bastion-field',
    'Bastion Field',
    'Allies within 90 m take 15% less damage and regen shields 50% faster.',
    ['bulwark'],
    60,
    15,
    { damageTakenMul: 0.85, shieldRegenMul: 1.5 },
    90,
  ),

  'repair-kit': c('repair-kit', 'Repair Kit', 'Restore 35% HP.', 20),
  'shield-kit': c('shield-kit', 'Shield Kit', 'Restore full shield.', 20),
  'fuel-cell': c('fuel-cell', 'Fuel Cell', 'Refill booster fuel.', 15),
};

function w(
  id: string,
  name: string,
  kind: WeaponDef['kind'],
  damage: number,
  fireIntervalSec: number,
  speed: number,
  rangeM: number,
  spread: number,
  extra: Partial<WeaponDef> = {},
): WeaponDef {
  return {
    id,
    name,
    kind,
    damage,
    fireIntervalSec,
    speed,
    rangeM,
    spread,
    homingTurnRate: 0,
    lockConeRad: 0,
    lockTimeSec: 0,
    splashRadius: 0,
    ...extra,
  };
}

function s(
  id: string,
  name: string,
  description: string,
  frames: SkillDef['frames'],
  cooldownSec: number,
  durationSec: number,
): SkillDef {
  return { id, name, description, frames, cooldownSec, durationSec, kind: 'skill' };
}

function b(
  id: string,
  name: string,
  description: string,
  frames: SkillDef['frames'],
  cooldownSec: number,
  durationSec: number,
  buff: SkillDef['buff'],
  auraRadiusM?: number,
): SkillDef {
  return {
    id,
    name,
    description,
    frames,
    cooldownSec,
    durationSec,
    kind: 'buff',
    buff,
    auraRadiusM,
  };
}

/** Enemy debuff: a 'skill' whose `buff` is carried by the victims the cast picks. */
function d(
  id: string,
  name: string,
  description: string,
  frames: SkillDef['frames'],
  cooldownSec: number,
  durationSec: number,
  buff: SkillDef['buff'],
): SkillDef {
  return { id, name, description, frames, cooldownSec, durationSec, kind: 'skill', buff };
}

function t(
  id: string,
  name: string,
  description: string,
  frames: SkillDef['frames'],
  toggleGroup: string,
): SkillDef {
  return {
    id,
    name,
    description,
    frames,
    cooldownSec: 2,
    durationSec: 0,
    kind: 'toggle',
    toggleGroup,
  };
}

function c(id: string, name: string, description: string, cooldownSec: number): SkillDef {
  return { id, name, description, frames: 'all', cooldownSec, durationSec: 0, kind: 'consumable' };
}
