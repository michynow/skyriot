import type { SkillDef, WeaponDef, WeaponLook } from '../types';

// Halo (support) weapons hit softest: the support class trades attack for defence and heals.
// Primary: `fireIntervalSec` is the reattack per pattern (count rounds at once); accuracy, pattern and overheat
// follow the genre's gun table (fighter ~ gatling, bomber ~ automatic, support ~ vulcan, tank ~ dualist).
// Secondary: missiles fire 1 x 2 (two in series) inside a narrow Valid Angle; the Bulwark salvo is 2 x 2 straight
// shells; Anvil bombs are lockless.
export const WEAPONS: Record<string, WeaponDef> = {
  'needle-cannon': w('needle-cannon', 'Needle Cannon', 'tracer', 22, 0.32, 2250, 1650, 0.012, {
    ...gun(0.85, 4, 6),
  }),
  'flak-repeater': w('flak-repeater', 'Flak Repeater', 'tracer', 32, 0.54, 1620, 1200, 0.03, {
    splashRadius: 4,
    ...gun(0.75, 3, 8),
  }),
  'pulse-blaster': w('pulse-blaster', 'Pulse Blaster', 'tracer', 40, 0.44, 2000, 1420, 0.015, {
    ...gun(0.8, 4, 6),
  }),
  'twin-autocannon': w('twin-autocannon', 'Twin Autocannon', 'tracer', 32, 0.24, 1880, 1500, 0.02, {
    ...gun(0.85, 2, 8),
  }),
  'sting-missile': w('sting-missile', 'Sting Missile', 'missile', 350, 1.6, 1100, 3000, 0, {
    look: look('thin', 'dart', 'flash', [2.6, 1.3, 0.2]),
    ...missile(6, 135),
    splashRadius: 5,
  }),
  'seeker-pod': w('seeker-pod', 'Seeker Pod', 'missile', 220, 1.6, 1060, 2600, 0, {
    look: look('ion', 'pod', 'shrapnel', [0.2, 1.6, 3]),
    ...missile(8, 145),
    splashRadius: 5,
  }),
  'brick-bomb': w('brick-bomb', 'Brick Bomb', 'rocket', 520, 3.0, 1800, 1350, 0.01, {
    look: look('billow', 'bomb', 'fireball', [3, 0.9, 0.1]),
    splashRadius: 22,
  }),
  'mortar-battery': w('mortar-battery', 'Mortar Battery', 'shell', 65, 2.6, 2400, 2400, 0, {
    look: look('arc', 'shell', 'plume', [1.8, 1.2, 0.4]),
    ...salvo(10),
    splashRadius: 20,
  }),
  // ---- Shop variants (tiers 2–3); each sits in the line of the stock weapon above it ----
  'quill-repeater': w('quill-repeater', 'Quill Repeater', 'tracer', 26, 0.304, 2300, 1720, 0.012, {
    ...gun(0.87, 4, 6),
  }),
  'lancet-cannon': w('lancet-cannon', 'Lancet Cannon', 'tracer', 28, 0.288, 2380, 1800, 0.011, {
    ...gun(0.9, 4, 6.5),
  }),
  'burst-flak': w('burst-flak', 'Burst Flak', 'tracer', 36, 0.51, 1650, 1240, 0.03, {
    splashRadius: 4.5,
    ...gun(0.77, 3, 8),
  }),
  'thunder-flak': w('thunder-flak', 'Thunder Flak', 'tracer', 40, 0.48, 1700, 1290, 0.03, {
    splashRadius: 5,
    ...gun(0.8, 3, 8.5),
  }),
  'arc-blaster': w('arc-blaster', 'Arc Blaster', 'tracer', 38, 0.42, 2050, 1470, 0.015, {
    ...gun(0.72, 4, 6),
  }),
  'prism-blaster': w('prism-blaster', 'Prism Blaster', 'tracer', 40, 0.4, 2100, 1520, 0.014, {
    ...gun(0.75, 4, 6.5),
  }),
  'twin-hammer': w('twin-hammer', 'Twin Hammer', 'tracer', 35, 0.23, 1900, 1540, 0.02, {
    ...gun(0.87, 2, 8),
  }),
  'quad-autocannon': w('quad-autocannon', 'Quad Autocannon', 'tracer', 38, 0.22, 1920, 1590, 0.02, {
    ...gun(0.9, 2, 8.5),
  }),
  'hornet-missile': w('hornet-missile', 'Hornet Missile', 'missile', 395, 1.6, 1140, 3100, 0, {
    look: look('thin', 'dart', 'flash', [3, 0.45, 0.15]),
    ...missile(5.5, 150),
    splashRadius: 5,
  }),
  'talon-missile': w('talon-missile', 'Talon Missile', 'missile', 440, 1.6, 1190, 3200, 0, {
    look: look('thin', 'dart', 'flash', [1.6, 2.6, 0.3]),
    ...missile(5, 160),
    splashRadius: 5.5,
  }),
  'hound-pod': w('hound-pod', 'Hound Pod', 'missile', 245, 1.6, 1100, 2700, 0, {
    look: look('ion', 'pod', 'shrapnel', [1.6, 0.4, 3]),
    ...missile(7.5, 150),
    splashRadius: 5,
  }),
  'warden-pod': w('warden-pod', 'Warden Pod', 'missile', 275, 1.6, 1140, 2800, 0, {
    look: look('ion', 'pod', 'shrapnel', [0.3, 3, 0.9]),
    ...missile(7, 155),
    splashRadius: 5.5,
  }),
  'slab-bomb': w('slab-bomb', 'Slab Bomb', 'rocket', 590, 3.0, 1850, 1380, 0.01, {
    look: look('billow', 'bomb', 'fireball', [3, 0.2, 0.2]),
    splashRadius: 23,
  }),
  'monolith-bomb': w('monolith-bomb', 'Monolith Bomb', 'rocket', 660, 3.0, 1900, 1420, 0.01, {
    look: look('billow', 'bomb', 'fireball', [2.4, 0.2, 2.4]),
    splashRadius: 24,
  }),
  'howler-battery': w('howler-battery', 'Howler Battery', 'shell', 75, 2.5, 2460, 2480, 0, {
    look: look('arc', 'shell', 'plume', [1.2, 1.8, 0.4]),
    ...salvo(10.5),
    splashRadius: 21,
  }),
  'quake-battery': w('quake-battery', 'Quake Battery', 'shell', 85, 2.4, 2530, 2550, 0, {
    look: look('arc', 'shell', 'plume', [1.9, 0.8, 0.4]),
    ...salvo(11),
    splashRadius: 22,
  }),
  // Base Turret gun (not a Frame weapon).
  'turret-flak': w('turret-flak', 'Turret Flak', 'tracer', 24, 0.2, 1750, 1420, 0.02, {
    splashRadius: 5,
  }),
};

function look(
  trail: WeaponLook['trail'],
  warhead: WeaponLook['warhead'],
  blast: WeaponLook['blast'],
  color: WeaponLook['color'],
): WeaponLook {
  return { trail, warhead, blast, color };
}

/** Primary: accuracy, rounds per pattern, overheat seconds. */
function gun(accuracy: number, count: number, overheatSec: number): Partial<WeaponDef> {
  return { accuracy, pattern: { count, series: 1 }, overheatSec };
}

/** Guided missile Secondary, 1 x 2. */
function missile(validAngleDeg: number, inductionDegPerSec: number): Partial<WeaponDef> {
  return { validAngleDeg, inductionDegPerSec, pattern: { count: 1, series: 2 } };
}

/** Bulwark salvo: 2 x 2 straight shells, the lock held through the whole salvo. */
function salvo(validAngleDeg: number): Partial<WeaponDef> {
  return { validAngleDeg, pattern: { count: 2, series: 2 } };
}

/*
 * Skill kits. Mechanics follow the genre's four gear classes (fighter / bomber / support / tank):
 * every Frame shares the long weapon and hull buffs plus Pivot Flip and Backdraft (bar 3); each Frame's
 * own kit is on bars 1-2. Durations and cooldowns are compressed for match length.
 */
export const SKILLS: Record<string, SkillDef> = {
  // ---- Shared (all Frames): long buffs, turn-around, reverse burst, consumables ----
  'gun-tune': b('gun-tune', 'Gun Tune', 'Primary deals +25% damage.', 'all', 300, 300, {
    primaryDamageMul: 1.25,
  }),
  'warhead-tune': b(
    'warhead-tune',
    'Warhead Tune',
    'Secondary deals +20% damage.',
    'all',
    300,
    300,
    { secondaryDamageMul: 1.2 },
  ),
  'steady-hands': b(
    'steady-hands',
    'Steady Hands',
    'Steadier aim: +10% Primary accuracy and a 20% wider missile Valid Angle.',
    'all',
    300,
    300,
    { accuracyAdd: 0.1, spreadMul: 0.6, lockConeMul: 1.2 },
  ),
  'hardened-hull': b('hardened-hull', 'Hardened Hull', 'Take 12% less damage.', 'all', 300, 300, {
    damageTakenMul: 0.88,
  }),
  'jink-jets': b(
    'jink-jets',
    'Jink Jets',
    '+12% Deflect chance (ignores the cap).',
    'all',
    300,
    300,
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
    'Missile racks hot: Secondary +30% damage, +1 missile per salvo, 30% wider Valid Angle.',
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
    'Bombing mode (press again for off): Secondary fires a tight forward salvo of 5 wide-burst proximity-fused rockets at air targets.',
    ['anvil'],
    'bombing',
  ),
  'ground-strike-mode': t(
    'ground-strike-mode',
    'Ground Strike Mode',
    'Bombing mode (press again for off): Secondary drops a stick of 3 heavy proximity-fused bombs straight down, big blasts, +40% damage vs Grounded/Docked targets.',
    ['anvil'],
    'bombing',
  ),
  'wide-lock-mode': t(
    'wide-lock-mode',
    'Wide Lock Mode',
    'Bombing mode (press again for off): Secondary lock cone widens by 22°, lock and range +45%, and each salvo sends a guided rocket at up to 3 enemy Ships in the cone.',
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
    300,
    300,
    { damageMul: 1.2 },
    300,
  ),
  'ward-lattice': b(
    'ward-lattice',
    'Ward Lattice',
    'Allies within 300 m take 15% less damage.',
    ['halo'],
    300,
    300,
    { damageTakenMul: 0.85 },
    300,
  ),
  'veer-field': b(
    'veer-field',
    'Veer Field',
    'Allies within 300 m get +10% Deflect chance (ignores the cap).',
    ['halo'],
    300,
    300,
    { deflectAdd: 0.1 },
    300,
  ),
  'renewal-pulse': s(
    'renewal-pulse',
    'Renewal Pulse',
    'Allies within 200 m (you too) instantly regain 10% max HP.',
    ['halo'],
    40,
    0,
  ),
  'recharge-pulse': s(
    'recharge-pulse',
    'Recharge Pulse',
    'Allies within 200 m (you too) instantly regain 30% max shield.',
    ['halo'],
    30,
    0,
  ),
  'mend-beam': s(
    'mend-beam',
    'Mend Beam',
    'Heal the most hurt ally within 400 m (or yourself) for 15% max HP.',
    ['halo'],
    30,
    0,
  ),
  'charge-beam': s(
    'charge-beam',
    'Charge Beam',
    'Recharge the ally within 400 m with the lowest shield (or yourself) for 20% max shield.',
    ['halo'],
    30,
    0,
  ),
  lifeline: s(
    'lifeline',
    'Lifeline',
    'Fully restore HP and shield of the most hurt ally within 400 m (or yourself).',
    ['halo'],
    300,
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
    'Landed only: anchor to the ground, first-person gunner view, Target lock. Guns fire x2.5 as fast, x1.5 damage, x1.4 range, 25% less damage taken.',
    ['bulwark'],
    0.3,
    0,
  ),
  'air-siege': s(
    'air-siege',
    'Air Siege',
    'Airborne only: brake and hover-lock in place, gunner view, Target lock. Guns fire x1.6 as fast, x1.15 damage and range, wider lock cone, 15% less damage taken.',
    ['bulwark'],
    0.3,
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
    'Rebuild the shield: restores 8% max shield per second for 8 s, even under fire.',
    ['bulwark'],
    30,
    8,
    { shieldRestorePerSec: 0.08 },
  ),
  'crash-frame': b(
    'crash-frame',
    'Crash Frame',
    'Terrain impacts cost half the HP.',
    ['bulwark'],
    300,
    300,
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

  'repair-kit': c('repair-kit', 'Repair Kit', 'Restore 8% HP.', 3),
  'shield-kit': c('shield-kit', 'Shield Kit', 'Restore 20% of the shield.', 3),
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
  const def: WeaponDef = {
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
    accuracy: 1,
    pattern: { count: 1, series: 1 },
    overheatSec: 0,
    validAngleDeg: 0,
    inductionDegPerSec: 0,
    ...extra,
  };
  def.homingTurnRate = (def.inductionDegPerSec * Math.PI) / 180;
  def.lockConeRad = (def.validAngleDeg * Math.PI) / 180;
  return def;
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
    cooldownSec: 0.3,
    durationSec: 0,
    kind: 'toggle',
    toggleGroup,
  };
}

function c(id: string, name: string, description: string, cooldownSec: number): SkillDef {
  return { id, name, description, frames: 'all', cooldownSec, durationSec: 0, kind: 'consumable' };
}
