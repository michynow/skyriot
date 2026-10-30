import type { SkillDef, WeaponDef } from '../types';

export const WEAPONS: Record<string, WeaponDef> = {
  'needle-cannon': w('needle-cannon', 'Needle Cannon', 'tracer', 28, 0.08, 900, 1100, 0.012),
  'flak-repeater': w('flak-repeater', 'Flak Repeater', 'tracer', 55, 0.18, 650, 800, 0.03, {
    splashRadius: 4,
  }),
  'pulse-blaster': w('pulse-blaster', 'Pulse Blaster', 'tracer', 34, 0.11, 800, 950, 0.015),
  'twin-autocannon': w('twin-autocannon', 'Twin Autocannon', 'tracer', 48, 0.12, 750, 1000, 0.02),
  'sting-missile': w('sting-missile', 'Sting Missile', 'missile', 260, 2.2, 190, 1400, 0, {
    homingTurnRate: 2.2,
    lockConeRad: 0.45,
    lockTimeSec: 0.8,
    splashRadius: 5,
  }),
  'seeker-pod': w('seeker-pod', 'Seeker Pod', 'missile', 180, 1.6, 175, 1200, 0, {
    homingTurnRate: 2.0,
    lockConeRad: 0.5,
    lockTimeSec: 0.7,
    splashRadius: 5,
  }),
  'brick-bomb': w('brick-bomb', 'Brick Bomb', 'rocket', 520, 3.0, 140, 900, 0.01, {
    splashRadius: 14,
  }),
  'mortar-battery': w('mortar-battery', 'Mortar Battery', 'shell', 380, 2.6, 220, 1600, 0.02, {
    splashRadius: 10,
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
  'phantom-weave': b(
    'phantom-weave',
    'Phantom Weave',
    'Evasion: +20% Deflect (beyond cap), +10% turn rate.',
    ['wasp'],
    240,
    90,
    {
      deflectAdd: 0.2,
      turnRateMul: 1.1,
    },
  ),
  'hunter-sight': b('hunter-sight', 'Hunter Sight', 'Missile lock time -40%.', ['wasp'], 180, 60, {
    lockTimeMul: 0.6,
  }),
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
  'bulk-plating': b(
    'bulk-plating',
    'Bulk Plating',
    '+25% max HP, -10% speed.',
    ['anvil'],
    240,
    120,
    { maxHpMul: 1.25, speedMul: 0.9 },
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
  overcharge: b(
    'overcharge',
    'Overcharge',
    'Allies within 150 m: shield and fuel regen x2.',
    ['halo'],
    200,
    90,
    {
      shieldRegenMul: 2,
      fuelRegenMul: 2,
    },
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
  fortify: b('fortify', 'Fortify', 'Take 30% less damage, -15% turn rate.', ['bulwark'], 240, 120, {
    damageTakenMul: 0.7,
    turnRateMul: 0.85,
  }),
  'barrage-calibration': b(
    'barrage-calibration',
    'Barrage Calibration',
    'All weapons +25% damage, +30% splash.',
    ['bulwark'],
    200,
    90,
    {
      damageMul: 1.25,
      splashMul: 1.3,
    },
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
  'ghost-skin': b(
    'ghost-skin',
    'Ghost Skin',
    '+20% Deflect (ignores cap) for a few seconds.',
    ['wasp'],
    5,
    5,
    { deflectAdd: 0.2 },
  ),
  'carpet-drop': s(
    'carpet-drop',
    'Carpet Drop',
    'Release a line of bombs below you.',
    ['anvil'],
    25,
    2,
  ),
  'iron-hide': b('iron-hide', 'Iron Hide', 'Take 40% less damage.', ['anvil'], 6, 6, {
    damageTakenMul: 0.6,
  }),
  'mend-beam': s(
    'mend-beam',
    'Mend Beam',
    'Heal the nearest ally in front of you over time.',
    ['halo'],
    12,
    4,
  ),
  'aegis-bubble': s(
    'aegis-bubble',
    'Aegis Bubble',
    'Shield all allies within 60 m.',
    ['halo'],
    40,
    6,
  ),
  'siege-anchor': s(
    'siege-anchor',
    'Siege Anchor',
    'Toggle Siege Mode: root in place, first-person gunner view, Target lock. Stronger when grounded.',
    ['bulwark'],
    1,
    0,
  ),
  'scrap-wall': s(
    'scrap-wall',
    'Scrap Wall',
    'Deploy a barrier that eats Projectiles.',
    ['bulwark'],
    30,
    8,
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
