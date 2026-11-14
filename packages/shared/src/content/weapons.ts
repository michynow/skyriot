import type { FrameId, SkillDef, WeaponDef, WeaponLook } from '../types';

// Halo (support) weapons hit softest: the support class trades attack for defence and heals.
// Primary: `fireIntervalSec` is the reattack per pattern (count rounds at once); accuracy, pattern and overheat
// follow the genre's gun table (fighter ~ gatling, bomber ~ automatic, support ~ vulcan, tank ~ dualist).
// Secondary: missiles fire 1 x 2 (two in series) inside a narrow Valid Angle; the Bulwark salvo is 2 x 2 straight
// shells; Anvil bombs are lockless.
export const WEAPONS: Record<string, WeaponDef> = {
  'needle-cannon': w('needle-cannon', 'Needle Cannon', 'tracer', 27, 0.32, 1350, 1380, 0.012, {
    ...gun(0.85, 4, 6),
  }),
  'flak-repeater': w('flak-repeater', 'Flak Repeater', 'tracer', 28, 0.54, 980, 1000, 0.03, {
    splashRadius: 4,
    ...gun(0.75, 3, 8),
  }),
  'pulse-blaster': w('pulse-blaster', 'Pulse Blaster', 'tracer', 44, 0.44, 1200, 1180, 0.015, {
    ...gun(0.8, 4, 6),
  }),
  'twin-autocannon': w('twin-autocannon', 'Twin Autocannon', 'tracer', 29, 0.24, 1120, 1250, 0.02, {
    ...gun(0.85, 2, 8),
  }),
  'sting-missile': w('sting-missile', 'Sting Missile', 'missile', 384, 1.6, 640, 2000, 0, {
    look: look('thin', 'dart', 'flash', [2.6, 1.3, 0.2]),
    ...missile(6, 135),
    splashRadius: 5,
  }),
  'seeker-pod': w('seeker-pod', 'Seeker Pod', 'missile', 220, 1.6, 620, 1730, 0, {
    look: look('ion', 'pod', 'shrapnel', [0.2, 1.6, 3]),
    ...missile(8, 145),
    splashRadius: 5,
  }),
  'brick-bomb': w('brick-bomb', 'Brick Bomb', 'rocket', 520, 3.0, 820, 1120, 0.01, {
    look: look('billow', 'bomb', 'fireball', [3, 0.9, 0.1]),
    splashRadius: 22,
  }),
  'mortar-battery': w('mortar-battery', 'Mortar Battery', 'shell', 65, 2.6, 1440, 2000, 0, {
    look: look('arc', 'shell', 'plume', [1.8, 1.2, 0.4]),
    ...salvo(10),
    splashRadius: 20,
  }),
  // ---- Shop variants (tiers 2–3); each sits in the line of the stock weapon above it ----
  'quill-repeater': w('quill-repeater', 'Quill Repeater', 'tracer', 31, 0.304, 1380, 1430, 0.012, {
    ...gun(0.87, 4, 6),
  }),
  'lancet-cannon': w('lancet-cannon', 'Lancet Cannon', 'tracer', 33, 0.288, 1420, 1500, 0.011, {
    ...gun(0.9, 4, 6.5),
  }),
  'burst-flak': w('burst-flak', 'Burst Flak', 'tracer', 32, 0.51, 990, 1030, 0.03, {
    splashRadius: 4.5,
    ...gun(0.77, 3, 8),
  }),
  'thunder-flak': w('thunder-flak', 'Thunder Flak', 'tracer', 36, 0.48, 1020, 1080, 0.03, {
    splashRadius: 5,
    ...gun(0.8, 3, 8.5),
  }),
  'arc-blaster': w('arc-blaster', 'Arc Blaster', 'tracer', 42, 0.42, 1230, 1220, 0.015, {
    ...gun(0.72, 4, 6),
  }),
  'prism-blaster': w('prism-blaster', 'Prism Blaster', 'tracer', 44, 0.4, 1260, 1270, 0.014, {
    ...gun(0.75, 4, 6.5),
  }),
  'twin-hammer': w('twin-hammer', 'Twin Hammer', 'tracer', 32, 0.23, 1140, 1280, 0.02, {
    ...gun(0.87, 2, 8),
  }),
  'quad-autocannon': w('quad-autocannon', 'Quad Autocannon', 'tracer', 35, 0.22, 1160, 1320, 0.02, {
    ...gun(0.9, 2, 8.5),
  }),
  'hornet-missile': w('hornet-missile', 'Hornet Missile', 'missile', 432, 1.6, 660, 2070, 0, {
    look: look('thin', 'dart', 'flash', [3, 0.45, 0.15]),
    ...missile(5.5, 150),
    splashRadius: 5,
  }),
  'talon-missile': w('talon-missile', 'Talon Missile', 'missile', 480, 1.6, 690, 2130, 0, {
    look: look('thin', 'dart', 'flash', [1.6, 2.6, 0.3]),
    ...missile(5, 160),
    splashRadius: 5.5,
  }),
  'hound-pod': w('hound-pod', 'Hound Pod', 'missile', 245, 1.6, 640, 1800, 0, {
    look: look('ion', 'pod', 'shrapnel', [1.6, 0.4, 3]),
    ...missile(7.5, 150),
    splashRadius: 5,
  }),
  'warden-pod': w('warden-pod', 'Warden Pod', 'missile', 275, 1.6, 660, 1870, 0, {
    look: look('ion', 'pod', 'shrapnel', [0.3, 3, 0.9]),
    ...missile(7, 155),
    splashRadius: 5.5,
  }),
  'slab-bomb': w('slab-bomb', 'Slab Bomb', 'rocket', 590, 3.0, 850, 1150, 0.01, {
    look: look('billow', 'bomb', 'fireball', [3, 0.2, 0.2]),
    splashRadius: 23,
  }),
  'monolith-bomb': w('monolith-bomb', 'Monolith Bomb', 'rocket', 660, 3.0, 870, 1180, 0.01, {
    look: look('billow', 'bomb', 'fireball', [2.4, 0.2, 2.4]),
    splashRadius: 24,
  }),
  'howler-battery': w('howler-battery', 'Howler Battery', 'shell', 75, 2.5, 1480, 2070, 0, {
    look: look('arc', 'shell', 'plume', [1.2, 1.8, 0.4]),
    ...salvo(10.5),
    splashRadius: 21,
  }),
  'quake-battery': w('quake-battery', 'Quake Battery', 'shell', 85, 2.4, 1520, 2120, 0, {
    look: look('arc', 'shell', 'plume', [1.9, 0.8, 0.4]),
    ...salvo(11),
    splashRadius: 22,
  }),
  // Base Turret gun (not a Frame weapon).
  'turret-flak': w('turret-flak', 'Turret Flak', 'tracer', 24, 0.2, 1050, 1180, 0.02, {
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
 * Skill kits. Mechanics follow the genre's four gear classes (fighter / bomber / support / tank) at their top
 * skill level: SP cost, duration, recharge and effect size per class. Names, descriptions and icons are our own.
 * Mapping of the genre's stats: attack % = damage multiplier; accuracy = Primary hit chance; defense = damage
 * taken (guns / Secondary separately); evasion = chance a gun round or a Secondary hit misses outright; blast
 * radii are scaled x0.2 to our maps. Toggles cost no SP to switch on and drain `spPerSec` while they run.
 */
/** Defense: `std` of gun damage and `adv` of Secondary damage is shrugged off. */
const defense = (std: number, adv: number) => ({
  damageTakenMul: 1 - std,
  secondaryDamageTakenMul: (1 - adv) / (1 - std),
});
const evasion = (std: number, adv: number) => ({ evasionStd: std, evasionAdv: adv });

export const SKILLS: Record<string, SkillDef> = {
  // ---- Every Frame: the five long buffs, tuned per Frame ----
  'gun-tune': b(
    'gun-tune',
    'Gun Tune',
    'Primary hits harder.',
    'all',
    50,
    290,
    300,
    {},
    {
      byFrame: {
        wasp: { buff: { primaryDamageMul: 1.05 } },
        anvil: { buff: { primaryDamageMul: 1.25 } },
        halo: { buff: { primaryDamageMul: 1.3 } },
        bulwark: { spCost: 48, buff: { primaryDamageMul: 1.35 } },
      },
    },
  ),
  'warhead-tune': b(
    'warhead-tune',
    'Warhead Tune',
    'Secondary hits harder.',
    'all',
    55,
    290,
    300,
    {},
    {
      byFrame: {
        wasp: { buff: { secondaryDamageMul: 1.35 } },
        anvil: { spCost: 53, buff: { secondaryDamageMul: 1.35 } },
        halo: { buff: { secondaryDamageMul: 1.4 } },
        bulwark: { spCost: 48, buff: { secondaryDamageMul: 1.35 } },
      },
    },
  ),
  'steady-hands': b(
    'steady-hands',
    'Steady Hands',
    'Steadier aim: Primary rounds hit more often.',
    'all',
    40,
    290,
    300,
    { accuracyAdd: 0.2745 },
    {
      byFrame: { wasp: { durationSec: 230, buff: { accuracyAdd: 0.1745 } } },
    },
  ),
  'hardened-hull': b(
    'hardened-hull',
    'Hardened Hull',
    'Take less damage from guns and from Secondary weapons.',
    'all',
    40,
    290,
    300,
    {},
    {
      byFrame: {
        wasp: { buff: defense(0.06, 0.06) },
        anvil: { buff: defense(0.2361, 0.2161) },
        halo: { buff: defense(0.3166, 0.1866) },
        bulwark: { buff: defense(0.1652, 0.1652) },
      },
    },
  ),
  'jink-jets': b(
    'jink-jets',
    'Jink Jets',
    'Evasion: enemy gun rounds and Secondary hits miss more often.',
    'all',
    40,
    290,
    300,
    {},
    {
      byFrame: {
        wasp: { buff: evasion(0.5173, 0.3352) },
        anvil: { buff: evasion(0.2561, 0.2161) },
        halo: { buff: evasion(0.1867, 0.1867) },
        bulwark: { buff: evasion(0.0852, 0.0852) },
      },
    },
  ),

  // ---- Wasp and Anvil: the two escape moves ----
  'pivot-flip': s(
    'pivot-flip',
    'Pivot Flip',
    'Snap the nose around 180 degrees in a flash, keeping your speed.',
    ['wasp', 'anvil'],
    10,
    15,
    0.7,
    {
      byFrame: { anvil: { cooldownSec: 20 } },
    },
  ),
  backdraft: s(
    'backdraft',
    'Backdraft',
    'Reverse thrusters: shoot 1000 m backwards, guns still facing forward.',
    ['wasp', 'anvil'],
    10,
    15,
    1.5,
    {
      byFrame: { anvil: { cooldownSec: 20 } },
    },
  ),

  // ---- Wasp (fighter): missile frenzy, raw speed, rolls on demand, a jammer ----
  'afterburn-dash': s(
    'afterburn-dash',
    'Afterburn Dash',
    'Instant overboost for 2 s at one and a half times boost speed, no fuel.',
    ['wasp'],
    60,
    30,
    2,
  ),
  overdrive: b(
    'overdrive',
    'Overdrive',
    'Missile racks hot: Secondary +15% damage, one more volley and one more missile per volley, Valid Angle +5°.',
    ['wasp'],
    100,
    290,
    300,
    {
      secondaryDamageMul: 1.15,
      salvoAdd: 1,
      salvoCountAdd: 1,
      validAngleAddDeg: 5.16,
    },
  ),
  'quiver-surge': b(
    'quiver-surge',
    'Quiver Surge',
    'Empty the racks for 30 s: two more volleys and two more missiles per volley, Secondary refires 30% sooner, +10% lock range.',
    ['wasp'],
    200,
    900,
    30,
    {
      salvoAdd: 2,
      salvoCountAdd: 2,
      secondaryFireRateMul: 1 / 0.7,
      advRangeMul: 1.1,
    },
  ),
  'trim-tabs': b(
    'trim-tabs',
    'Trim Tabs',
    'Fine-tuned control surfaces for 60 s: +10% turn rate and strafe speed.',
    ['wasp'],
    100,
    50,
    60,
    {
      turnRateMul: 1.1,
      strafeMul: 1.1,
    },
  ),
  'roll-cascade': t(
    'roll-cascade',
    'Roll Cascade',
    'While on, Barrel Rolls chain back to back with no cooldown.',
    ['wasp'],
    25,
    {
      rollCooldownMul: 0,
    },
  ),
  'blind-tag': d(
    'blind-tag',
    'Blind Tag',
    'Jam the nearest enemy ahead (450 m) for 7 s: it gets no missile warnings.',
    ['wasp'],
    50,
    420,
    7,
    {
      missileBlind: true,
    },
  ),

  // ---- Anvil (bomber): bombing modes, one huge shot, decoys, stealth, last-resort blast ----
  'ground-strike-mode': t(
    'ground-strike-mode',
    'Ground Strike Mode',
    'Bombing mode: Secondary drops a stick of heavy proximity bombs, +70% damage, bigger blasts, +40% vs Grounded/Docked targets.',
    ['anvil'],
    6,
    undefined,
    'bombing',
  ),
  'air-barrage-mode': t(
    'air-barrage-mode',
    'Air Barrage Mode',
    'Bombing mode: Secondary fires a tight forward salvo of 5 proximity-fused rockets at air targets.',
    ['anvil'],
    6,
    undefined,
    'bombing',
  ),
  'wide-lock-mode': t(
    'wide-lock-mode',
    'Wide Lock Mode',
    'Bombing mode: Secondary lock cone +22°, lock and range +45%, and each salvo sends a guided rocket at up to 6 enemy Ships in the cone.',
    ['anvil'],
    6,
    undefined,
    'bombing',
  ),
  'overcharge-round': b(
    'overcharge-round',
    'Overcharge Round',
    'Charge the guns (10 s): the next Primary round hits for x12 damage, never misses its Target and flies twice as far.',
    ['anvil'],
    37,
    5,
    10,
    {
      primaryShotMul: 12,
    },
  ),
  'shield-damper': b(
    'shield-damper',
    'Shield Damper',
    'Shield takes 20% less damage.',
    ['anvil'],
    80,
    180,
    180,
    {
      shieldDamageTakenMul: 0.8,
    },
  ),
  'chaff-screen': b(
    'chaff-screen',
    'Chaff Screen',
    'Trail 4 decoys for 60 s: each one soaks a whole hit.',
    ['anvil'],
    70,
    60,
    60,
    {
      absorbHits: 4,
    },
  ),
  'shroud-veil': t(
    'shroud-veil',
    'Shroud Veil',
    'Stealth while on: off enemy radar beyond 180 m and unlockable. Weapons and Skills are offline until you switch it off.',
    ['anvil'],
    22,
    {
      cloak: true,
      noAttack: true,
      noSkills: true,
    },
  ),
  'core-breach': s(
    'core-breach',
    'Core Breach',
    'Overload the reactor and explode, dealing your current HP as damage to every enemy within 280 m. Once per sortie day: the recharge runs through death.',
    ['anvil'],
    200,
    43200,
    0,
  ),

  // ---- Halo (support): team auras, heals and shield refills on a 1 s recharge, SP is the limit ----
  'zenith-tune': b(
    'zenith-tune',
    'Zenith Tune',
    'Both weapons hit harder: Secondary +39%, Primary +15%.',
    ['halo'],
    50,
    290,
    300,
    {
      secondaryDamageMul: 1.39,
      primaryDamageMul: 1.15,
    },
  ),
  'renewal-pulse': s(
    'renewal-pulse',
    'Renewal Pulse',
    'Allies within 200 m (you too) regain 4% max HP.',
    ['halo'],
    70,
    1,
    0,
  ),
  'mend-beam': s(
    'mend-beam',
    'Mend Beam',
    'Heal the most hurt ally within 400 m (or yourself) for 15% max HP.',
    ['halo'],
    30,
    1,
    0,
  ),
  'recharge-pulse': s(
    'recharge-pulse',
    'Recharge Pulse',
    'Allies within 200 m (you too) regain 5% max shield.',
    ['halo'],
    70,
    1,
    0,
  ),
  'charge-beam': s(
    'charge-beam',
    'Charge Beam',
    'Recharge the ally within 400 m with the lowest shield (or yourself) for 20% max shield.',
    ['halo'],
    30,
    1,
    0,
  ),
  'rally-field': b(
    'rally-field',
    'Rally Field',
    'Allies within 300 m deal +15% damage.',
    ['halo'],
    20,
    410,
    420,
    { damageMul: 1.15 },
    {},
    300,
  ),
  'ward-lattice': b(
    'ward-lattice',
    'Ward Lattice',
    'Allies within 300 m take 15% less damage.',
    ['halo'],
    20,
    410,
    420,
    { damageTakenMul: 0.8517 },
    {},
    300,
  ),
  'veer-field': b(
    'veer-field',
    'Veer Field',
    'Allies within 300 m get +15% evasion.',
    ['halo'],
    20,
    410,
    420,
    evasion(0.1483, 0.1483),
    {},
    300,
  ),
  sanctum: b(
    'sanctum',
    'Sanctum',
    'Take no damage for 8 s. Weapons and Skills are offline while it holds.',
    ['halo'],
    100,
    600,
    8,
    {
      invulnerable: true,
      noAttack: true,
      noSkills: true,
    },
  ),
  'reverse-drive': t(
    'reverse-drive',
    'Reverse Drive',
    'While on, the Halo flies backwards, nose and guns still forward. No boost.',
    ['halo'],
    6,
    {
      reverse: true,
    },
  ),
  'fuel-line': s(
    'fuel-line',
    'Fuel Line',
    'Top up half a tank of booster fuel on the ally within 400 m who is lowest (or yourself).',
    ['halo'],
    30,
    2.5,
    0,
  ),
  'thrift-circuit': b(
    'thrift-circuit',
    'Thrift Circuit',
    'Skills cost 30% less SP.',
    ['halo'],
    20,
    290,
    300,
    { spCostMul: 0.7 },
  ),
  'scan-pulse': s(
    'scan-pulse',
    'Scan Pulse',
    'Expose every stealthed enemy inside your radar range (their stealth ends).',
    ['halo'],
    15,
    3,
    0,
  ),
  lifeline: s(
    'lifeline',
    'Lifeline',
    'Fully restore HP, shield, SP and fuel of the most hurt ally within 400 m (or yourself).',
    ['halo'],
    0,
    900,
    0,
  ),
  'dispel-lance': s(
    'dispel-lance',
    'Dispel Lance',
    'Strip every buff and running mode (Siege, bombing, stealth) off the nearest enemy ahead (600 m).',
    ['halo'],
    100,
    300,
    0,
  ),
  purge: s(
    'purge',
    'Purge',
    'You and allies within 120 m shed every enemy debuff.',
    ['halo'],
    50,
    15,
    0.5,
  ),

  // ---- Bulwark (tank): siege modes, missile immunity, shield rebuild, slow and shield lock, one huge shell ----
  'siege-anchor': s(
    'siege-anchor',
    'Ground Siege',
    'Landed only: anchor to the ground, first-person gunner view, Target lock. Guns fire x2.5 as fast, x1.5 damage, x1.4 range, 25% less damage taken. Drains SP while it holds.',
    ['bulwark'],
    0,
    0.3,
    0,
    { spPerSec: 3 },
  ),
  'air-siege': s(
    'air-siege',
    'Air Siege',
    'Airborne only: brake and hover-lock in place, gunner view, Target lock. Guns fire x1.6 as fast, x1.15 damage and range, wider lock cone, 15% less damage taken. Drains SP while it holds.',
    ['bulwark'],
    0,
    0.3,
    0,
    { spPerSec: 3 },
  ),
  'siege-bastion': t(
    'siege-bastion',
    'Bastion Siege',
    'Landed only: dig in as a fixed turret. 17% less damage taken; the Bulwark cannot drive while it holds.',
    ['bulwark'],
    3,
    {
      damageTakenMul: 0.83,
      groundSpeedMul: 0,
    },
  ),
  'shield-weave': b(
    'shield-weave',
    'Shield Weave',
    'Rebuild the shield: 60% of max shield over 9 s, even under fire.',
    ['bulwark'],
    60,
    10,
    9,
    {
      shieldRestorePerSec: 0.067,
    },
  ),
  'blast-ward': b(
    'blast-ward',
    'Blast Ward',
    'For 10 s, missiles, rockets, bombs and shells do no damage to you.',
    ['bulwark'],
    40,
    60,
    10,
    {
      secondaryDamageTakenMul: 0,
    },
  ),
  'track-drive': t(
    'track-drive',
    'Track Drive',
    'Landed: drive at x2.75 speed while on.',
    ['bulwark'],
    8,
    { groundSpeedMul: 2.75 },
  ),
  'snare-tag': d(
    'snare-tag',
    'Snare Tag',
    'Tag the nearest enemy ahead (450 m): -35% speed for 10 s.',
    ['bulwark'],
    50,
    300,
    10,
    {
      speedMul: 0.65,
    },
  ),
  'ground-shroud': t(
    'ground-shroud',
    'Ground Shroud',
    'Landed only: stealth while on (hidden beyond 180 m, no locks). Firing or lifting off drops it.',
    ['bulwark'],
    8,
    {
      cloak: true,
    },
  ),
  'shield-breaker': d(
    'shield-breaker',
    'Shield Breaker',
    'Lock the shield of the nearest enemy ahead (450 m): no shield regeneration or Shield Weave for 12 s.',
    ['bulwark'],
    40,
    360,
    12,
    {
      shieldRegenMul: 0,
    },
  ),
  'quake-round': b(
    'quake-round',
    'Quake Round',
    'Charge the guns (10 s): the next Primary round hits for x36 damage, never misses its Target and bursts in a 280 m blast.',
    ['bulwark'],
    150,
    5,
    10,
    {
      primaryShotMul: 36,
      primaryShotSplashM: 280,
    },
  ),

  'repair-kit': c('repair-kit', 'Repair Kit', 'Restore 8% HP.', 3),
  'shield-kit': c('shield-kit', 'Shield Kit', 'Restore 20% of the shield.', 3),
  'sp-kit': c('sp-kit', 'SP Kit', 'Restore 100 SP.', 3),
  'fuel-cell': c('fuel-cell', 'Fuel Cell', 'Refill booster fuel.', 15),
};

const _byFrame = new Map<string, SkillDef>();
/** The Skill as `frame` casts and carries it: the per-Frame overrides (`byFrame`) laid over the base def. */
export function skillFor(id: string, frame: FrameId): SkillDef | undefined {
  const base = SKILLS[id];
  const over = base?.byFrame?.[frame];
  if (!base || !over) return base;
  const key = `${id}/${frame}`;
  let def = _byFrame.get(key);
  if (!def) _byFrame.set(key, (def = { ...base, ...over }));
  return def;
}

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

type SkillExtra = Pick<SkillDef, 'byFrame' | 'spPerSec'>;

function s(
  id: string,
  name: string,
  description: string,
  frames: SkillDef['frames'],
  spCost: number,
  cooldownSec: number,
  durationSec: number,
  extra: SkillExtra = {},
): SkillDef {
  return {
    id,
    name,
    description,
    frames,
    cooldownSec,
    durationSec,
    spCost,
    kind: 'skill',
    ...extra,
  };
}

function b(
  id: string,
  name: string,
  description: string,
  frames: SkillDef['frames'],
  spCost: number,
  cooldownSec: number,
  durationSec: number,
  buff: SkillDef['buff'],
  extra: SkillExtra = {},
  auraRadiusM?: number,
): SkillDef {
  return {
    id,
    name,
    description,
    frames,
    cooldownSec,
    durationSec,
    spCost,
    kind: 'buff',
    buff,
    auraRadiusM,
    ...extra,
  };
}

/** Enemy debuff: a 'skill' whose `buff` is carried by the victims the cast picks. */
function d(
  id: string,
  name: string,
  description: string,
  frames: SkillDef['frames'],
  spCost: number,
  cooldownSec: number,
  durationSec: number,
  buff: SkillDef['buff'],
): SkillDef {
  return { id, name, description, frames, cooldownSec, durationSec, spCost, kind: 'skill', buff };
}

/** Toggle: free to switch, drains `spPerSec` while on; `buff` applies while on. Its group defaults to itself. */
function t(
  id: string,
  name: string,
  description: string,
  frames: SkillDef['frames'],
  spPerSec: number,
  buff?: SkillDef['buff'],
  toggleGroup: string = id,
): SkillDef {
  return {
    id,
    name,
    description,
    frames,
    cooldownSec: 0.3,
    durationSec: 0,
    spCost: 0,
    spPerSec,
    kind: 'toggle',
    buff,
    toggleGroup,
  };
}

function c(id: string, name: string, description: string, cooldownSec: number): SkillDef {
  return {
    id,
    name,
    description,
    frames: 'all',
    cooldownSec,
    durationSec: 0,
    spCost: 0,
    kind: 'consumable',
  };
}
