import type { SkillDef, WeaponDef } from '../types';

export const WEAPONS: Record<string, WeaponDef> = {
  'needle-cannon': w('needle-cannon', 'Needle Cannon', 'tracer', 20, 0.08, 900, 1100, 0.012),
  'flak-repeater': w('flak-repeater', 'Flak Repeater', 'tracer', 38, 0.18, 650, 800, 0.03, {
    splashRadius: 4,
  }),
  'pulse-blaster': w('pulse-blaster', 'Pulse Blaster', 'tracer', 24, 0.11, 800, 950, 0.015),
  'twin-autocannon': w('twin-autocannon', 'Twin Autocannon', 'tracer', 34, 0.12, 750, 1000, 0.02),
  'sting-missile': w('sting-missile', 'Sting Missile', 'missile', 384, 1.6, 250, 1500, 0, {
    homingTurnRate: 2.4,
    lockConeRad: 0.45,
    lockTimeSec: 1.2,
    splashRadius: 5,
  }),
  'seeker-pod': w('seeker-pod', 'Seeker Pod', 'missile', 272, 1.6, 240, 1300, 0, {
    homingTurnRate: 2.5,
    lockConeRad: 0.5,
    lockTimeSec: 1,
    splashRadius: 5,
  }),
  'brick-bomb': w('brick-bomb', 'Brick Bomb', 'rocket', 520, 3.0, 140, 900, 0.01, {
    splashRadius: 22,
  }),
  'mortar-battery': w('mortar-battery', 'Mortar Battery', 'shell', 380, 2.6, 220, 1600, 0.02, {
    splashRadius: 10,
  }),
  // ---- Shop variants (tiers 2–3); each sits in the line of the stock weapon above it ----
  'quill-repeater': w('quill-repeater', 'Quill Repeater', 'tracer', 22, 0.076, 920, 1150, 0.012),
  'lancet-cannon': w('lancet-cannon', 'Lancet Cannon', 'tracer', 24, 0.072, 950, 1200, 0.011),
  'burst-flak': w('burst-flak', 'Burst Flak', 'tracer', 43, 0.17, 660, 830, 0.03, {
    splashRadius: 4.5,
  }),
  'thunder-flak': w('thunder-flak', 'Thunder Flak', 'tracer', 49, 0.16, 680, 860, 0.03, {
    splashRadius: 5,
  }),
  'arc-blaster': w('arc-blaster', 'Arc Blaster', 'tracer', 27, 0.105, 820, 980, 0.015),
  'prism-blaster': w('prism-blaster', 'Prism Blaster', 'tracer', 30, 0.1, 840, 1010, 0.014),
  'twin-hammer': w('twin-hammer', 'Twin Hammer', 'tracer', 38, 0.115, 760, 1030, 0.02),
  'quad-autocannon': w('quad-autocannon', 'Quad Autocannon', 'tracer', 42, 0.11, 770, 1060, 0.02),
  'hornet-missile': w('hornet-missile', 'Hornet Missile', 'missile', 432, 1.55, 260, 1550, 0, {
    homingTurnRate: 2.6,
    lockConeRad: 0.45,
    lockTimeSec: 1.1,
    splashRadius: 5,
  }),
  'talon-missile': w('talon-missile', 'Talon Missile', 'missile', 480, 1.5, 270, 1600, 0, {
    homingTurnRate: 2.8,
    lockConeRad: 0.47,
    lockTimeSec: 1,
    splashRadius: 5.5,
  }),
  'hound-pod': w('hound-pod', 'Hound Pod', 'missile', 304, 1.55, 250, 1350, 0, {
    homingTurnRate: 2.6,
    lockConeRad: 0.5,
    lockTimeSec: 0.9,
    splashRadius: 5,
  }),
  'warden-pod': w('warden-pod', 'Warden Pod', 'missile', 344, 1.5, 260, 1400, 0, {
    homingTurnRate: 2.7,
    lockConeRad: 0.52,
    lockTimeSec: 0.8,
    splashRadius: 5.5,
  }),
  'slab-bomb': w('slab-bomb', 'Slab Bomb', 'rocket', 590, 2.9, 145, 920, 0.01, {
    splashRadius: 23,
  }),
  'monolith-bomb': w('monolith-bomb', 'Monolith Bomb', 'rocket', 660, 2.8, 150, 950, 0.01, {
    splashRadius: 24,
  }),
  'howler-battery': w('howler-battery', 'Howler Battery', 'shell', 430, 2.5, 225, 1650, 0.02, {
    splashRadius: 11,
  }),
  'quake-battery': w('quake-battery', 'Quake Battery', 'shell', 480, 2.4, 230, 1700, 0.02, {
    splashRadius: 12,
  }),
  // Base Turret gun (not a Frame weapon).
  'turret-flak': w('turret-flak', 'Turret Flak', 'tracer', 24, 0.2, 700, 950, 0.02, {
    splashRadius: 5,
  }),
};

/*
 * Skill kits. Mechanics follow the genre's four gear classes (fighter / bomber / support / tank):
 * every Frame shares the long weapon and hull buffs plus Pivot Flip and Backdraft (bar 3); each Frame's
 * own kit is on bars 1-2. Durations and cooldowns are compressed for match length.
 */
export const SKILLS: Record<string, SkillDef> = {
  // ---- Shared (all Frames): long buffs, turn-around, reverse burst, consumables ----
  'gun-tune': b('gun-tune', 'Gun Tune', 'Primary deals +25% damage.', 'all', 120, 90, {
    primaryDamageMul: 1.25,
  }),
  'warhead-tune': b(
    'warhead-tune',
    'Warhead Tune',
    'Secondary deals +20% damage.',
    'all',
    120,
    90,
    { secondaryDamageMul: 1.2 },
  ),
  'steady-hands': b(
    'steady-hands',
    'Steady Hands',
    'Tighter guns and faster locks: -40% Primary spread, missile locks 20% faster.',
    'all',
    120,
    90,
    { spreadMul: 0.6, lockTimeMul: 0.8 },
  ),
  'hardened-hull': b('hardened-hull', 'Hardened Hull', 'Take 12% less damage.', 'all', 120, 90, {
    damageTakenMul: 0.88,
  }),
  'jink-jets': b(
    'jink-jets',
    'Jink Jets',
    '+12% Deflect chance (ignores the cap).',
    'all',
    120,
    90,
    { deflectAdd: 0.12 },
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

  // ---- Wasp (fighter): missile frenzy, raw speed and agility, rolls on demand, anti-evasion ----
  'afterburn-dash': s(
    'afterburn-dash',
    'Afterburn Dash',
    'Straight-line boost burst for 2.5 s, no fuel cost.',
    ['wasp'],
    20,
    2.5,
  ),
  overdrive: b(
    'overdrive',
    'Overdrive',
    'Missile racks hot: Secondary +30% damage, +1 missile per salvo, 30% wider lock cone.',
    ['wasp'],
    120,
    90,
    { secondaryDamageMul: 1.3, salvoAdd: 1, lockConeMul: 1.3 },
  ),
  'quiver-surge': b(
    'quiver-surge',
    'Quiver Surge',
    'Empty the racks: +2 missiles per salvo and Secondary refires 40% faster for 15 s.',
    ['wasp'],
    150,
    15,
    { salvoAdd: 2, secondaryFireRateMul: 1.4 },
  ),
  'trim-tabs': b(
    'trim-tabs',
    'Trim Tabs',
    'Fine-tuned control surfaces: +15% turn rate.',
    ['wasp'],
    40,
    30,
    { turnRateMul: 1.15 },
  ),
  'roll-cascade': b(
    'roll-cascade',
    'Roll Cascade',
    'Barrel Rolls have no cooldown for 8 s (they still cost fuel).',
    ['wasp'],
    45,
    8,
    { rollCooldownMul: 0 },
  ),
  'blind-tag': d(
    'blind-tag',
    'Blind Tag',
    'Jam the nearest enemy ahead (450 m) for 10 s: no missile warning, and its Barrel Rolls no longer shake missiles.',
    ['wasp'],
    40,
    10,
    { missileBlind: true },
  ),
  'shield-damper': b(
    'shield-damper',
    'Shield Damper',
    'Shield takes 35% less damage.',
    ['wasp', 'anvil'],
    60,
    30,
    { shieldDamageTakenMul: 0.65 },
  ),

  // ---- Anvil (bomber): bombing modes, one huge shot, decoys, stealth, last-resort blast ----
  'air-barrage-mode': t(
    'air-barrage-mode',
    'Air Barrage Mode',
    'Bombing mode (press again for off): Secondary fires a forward salvo of 3 proximity-fused rockets at air targets.',
    ['anvil'],
    'bombing',
  ),
  'ground-strike-mode': t(
    'ground-strike-mode',
    'Ground Strike Mode',
    'Bombing mode (press again for off): Secondary drops heavy proximity-fused bombs straight down, +40% damage vs Grounded/Docked targets and splash.',
    ['anvil'],
    'bombing',
  ),
  'overcharge-round': b(
    'overcharge-round',
    'Overcharge Round',
    'Arm the guns (10 s): the next Primary round hits for x10 damage, flies twice as far and dead straight.',
    ['anvil'],
    20,
    10,
    { primaryShotMul: 10 },
  ),
  'chaff-screen': b(
    'chaff-screen',
    'Chaff Screen',
    'Trail 4 decoys for 20 s: each one soaks a whole hit, however big.',
    ['anvil'],
    40,
    20,
    { absorbHits: 4 },
  ),
  'shroud-veil': b(
    'shroud-veil',
    'Shroud Veil',
    'Stealth for 12 s: vanish from enemy radar beyond 180 m and refuse missile locks. Firing drops the veil.',
    ['anvil'],
    45,
    12,
    { cloak: true },
  ),
  'core-breach': s(
    'core-breach',
    'Core Breach',
    'Overload the reactor and explode, dealing damage equal to your current HP to every enemy within 150 m. The cooldown keeps running through death and respawn.',
    ['anvil'],
    240,
    0,
  ),

  // ---- Halo (support): team auras, instant heals and shield refills, invulnerability, cleanse/dispel ----
  'rally-field': b(
    'rally-field',
    'Rally Field',
    'Allies within 300 m deal +20% damage.',
    ['halo'],
    240,
    120,
    { damageMul: 1.2 },
    300,
  ),
  'ward-lattice': b(
    'ward-lattice',
    'Ward Lattice',
    'Allies within 300 m take 20% less damage.',
    ['halo'],
    240,
    120,
    { damageTakenMul: 0.8 },
    300,
  ),
  'veer-field': b(
    'veer-field',
    'Veer Field',
    'Allies within 300 m get +15% Deflect chance (ignores the cap).',
    ['halo'],
    240,
    120,
    { deflectAdd: 0.15 },
    300,
  ),
  'renewal-pulse': s(
    'renewal-pulse',
    'Renewal Pulse',
    'Allies within 200 m (you too) instantly regain 20% max HP.',
    ['halo'],
    12,
    0,
  ),
  'recharge-pulse': s(
    'recharge-pulse',
    'Recharge Pulse',
    'Allies within 200 m (you too) instantly regain 30% max shield.',
    ['halo'],
    12,
    0,
  ),
  'mend-beam': s(
    'mend-beam',
    'Mend Beam',
    'Heal the most hurt ally within 400 m (or yourself) for 30% max HP.',
    ['halo'],
    6,
    0,
  ),
  'charge-beam': s(
    'charge-beam',
    'Charge Beam',
    'Recharge the ally within 400 m with the lowest shield (or yourself) for 40% max shield.',
    ['halo'],
    6,
    0,
  ),
  lifeline: s(
    'lifeline',
    'Lifeline',
    'Fully restore HP and shield of the most hurt ally within 400 m (or yourself).',
    ['halo'],
    180,
    0,
  ),
  sanctum: b(
    'sanctum',
    'Sanctum',
    'Take no damage for 6 s. Weapons are offline while it holds.',
    ['halo'],
    120,
    6,
    { invulnerable: true, noAttack: true },
  ),
  purge: s(
    'purge',
    'Purge',
    'You and allies within 120 m shed every enemy debuff and every missile lock.',
    ['halo'],
    45,
    0.5,
  ),
  'dispel-lance': s(
    'dispel-lance',
    'Dispel Lance',
    'Strip every buff off the nearest enemy ahead (600 m).',
    ['halo'],
    45,
    0,
  ),
  'scan-pulse': s(
    'scan-pulse',
    'Scan Pulse',
    'Expose every stealthed enemy within 600 m (their stealth ends).',
    ['halo'],
    15,
    0,
  ),

  // ---- Bulwark (tank): siege modes, missile immunity, shield rebuild, slow and shield lock, big shot ----
  'siege-anchor': s(
    'siege-anchor',
    'Ground Siege',
    'Landed only: anchor to the ground, first-person gunner view, Target lock. x1.5 damage, x1.4 range, 25% less damage taken.',
    ['bulwark'],
    1,
    0,
  ),
  'air-siege': s(
    'air-siege',
    'Air Siege',
    'Airborne only: brake and hover-lock in place, gunner view, Target lock. x1.15 damage and range, wider lock cone, 15% less damage taken.',
    ['bulwark'],
    1,
    0,
  ),
  'blast-ward': b(
    'blast-ward',
    'Blast Ward',
    'For 10 s, missiles, rockets, bombs and shells do no damage to you.',
    ['bulwark'],
    45,
    10,
    { secondaryDamageTakenMul: 0 },
  ),
  'shield-weave': b(
    'shield-weave',
    'Shield Weave',
    'Rebuild the shield: restores 12% max shield per second for 8 s, even under fire.',
    ['bulwark'],
    24,
    8,
    { shieldRestorePerSec: 0.12 },
  ),
  'crash-frame': b(
    'crash-frame',
    'Crash Frame',
    'Terrain impacts cost half the HP.',
    ['bulwark'],
    150,
    120,
    { collisionDamageMul: 0.5 },
  ),
  'track-drive': b(
    'track-drive',
    'Track Drive',
    'Landed: drive twice as fast for 20 s.',
    ['bulwark'],
    40,
    20,
    { groundSpeedMul: 2 },
  ),
  'snare-tag': d(
    'snare-tag',
    'Snare Tag',
    'Tag the nearest enemy ahead (450 m): -35% speed for 10 s.',
    ['bulwark'],
    30,
    10,
    { speedMul: 0.65 },
  ),
  'shield-breaker': d(
    'shield-breaker',
    'Shield Breaker',
    'Lock the shield of the nearest enemy ahead (450 m): no shield regeneration or Shield Weave for 20 s.',
    ['bulwark'],
    60,
    20,
    { shieldRegenMul: 0 },
  ),
  'ground-shroud': b(
    'ground-shroud',
    'Ground Shroud',
    'Landed only: stealth for 20 s (hidden beyond 180 m, no locks). Firing drops it.',
    ['bulwark'],
    45,
    20,
    { cloak: true },
  ),
  'quake-round': s(
    'quake-round',
    'Quake Round',
    'Fire a charged shell 180 m ahead: 600 damage to every enemy within 70 m of the blast.',
    ['bulwark'],
    90,
    0,
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
