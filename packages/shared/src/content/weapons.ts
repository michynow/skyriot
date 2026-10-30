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
  'ghost-skin': s(
    'ghost-skin',
    'Ghost Skin',
    '+20% Deflect (ignores cap) for a few seconds.',
    ['wasp'],
    30,
    5,
  ),
  'carpet-drop': s(
    'carpet-drop',
    'Carpet Drop',
    'Release a line of bombs below you.',
    ['anvil'],
    25,
    2,
  ),
  'iron-hide': s('iron-hide', 'Iron Hide', 'Take 40% less damage.', ['anvil'], 35, 6),
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

function c(id: string, name: string, description: string, cooldownSec: number): SkillDef {
  return { id, name, description, frames: 'all', cooldownSec, durationSec: 0, kind: 'consumable' };
}
