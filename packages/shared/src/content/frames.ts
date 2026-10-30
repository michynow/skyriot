import type { FrameDef, FrameId } from '../types';

// Starting tuning. Live-tweakable via the dev Leva panel; export new values back here.
export const FRAMES: Record<FrameId, FrameDef> = {
  wasp: {
    id: 'wasp',
    name: 'Wasp',
    role: 'Agile fighter',
    maxHp: 900,
    maxShield: 400,
    shieldRegenPerSec: 60,
    shieldRegenDelaySec: 4,
    minSpeed: 0,
    cruiseSpeed: 135,
    maxSpeed: 200,
    boostSpeed: 300,
    accel: 140,
    turnRate: 2.9,
    strafeSpeed: 55,
    verticalSpeed: 50,
    fuelBurnPerSec: 0.22,
    fuelRegenPerSec: 0.12,
    rollImpulse: 120,
    rollInvulnSec: 0.25,
    rollCooldownSec: 3,
    rollFuelCost: 0.12,
    deflectChance: 0.15,
    ammo1Max: 1200,
    ammo2Max: 4,
    radarRangeM: 1600,
    radius: 4.4,
    halfLength: 6.0,
    canHover: false,
    primary: 'needle-cannon',
    secondary: 'sting-missile',
    hotbar: [
      'afterburn-dash',
      'overdrive',
      'phantom-weave',
      'hunter-sight',
      'flares',
      'ghost-skin',
      null,
      'repair-kit',
      'shield-kit',
      'fuel-cell',
    ],
  },
  anvil: {
    id: 'anvil',
    name: 'Anvil',
    role: 'Heavy bomber',
    maxHp: 2200,
    maxShield: 700,
    shieldRegenPerSec: 70,
    shieldRegenDelaySec: 5,
    minSpeed: 0,
    cruiseSpeed: 95,
    maxSpeed: 140,
    boostSpeed: 210,
    accel: 80,
    turnRate: 1.45,
    strafeSpeed: 30,
    verticalSpeed: 30,
    fuelBurnPerSec: 0.18,
    fuelRegenPerSec: 0.1,
    rollImpulse: 75,
    rollInvulnSec: 0.25,
    rollCooldownSec: 4,
    rollFuelCost: 0.18,
    deflectChance: 0.04,
    ammo1Max: 500,
    ammo2Max: 12,
    radarRangeM: 1300,
    radius: 7.2,
    halfLength: 10.0,
    canHover: false,
    primary: 'flak-repeater',
    secondary: 'brick-bomb',
    hotbar: [
      'air-barrage-mode',
      'ground-strike-mode',
      'carpet-drop',
      'iron-hide',
      'bulk-plating',
      'flares',
      null,
      'repair-kit',
      'shield-kit',
      'fuel-cell',
    ],
  },
  halo: {
    id: 'halo',
    name: 'Halo',
    role: 'Support',
    maxHp: 1300,
    maxShield: 900,
    shieldRegenPerSec: 90,
    shieldRegenDelaySec: 3,
    minSpeed: 0,
    cruiseSpeed: 115,
    maxSpeed: 170,
    boostSpeed: 260,
    accel: 110,
    turnRate: 2.2,
    strafeSpeed: 42,
    verticalSpeed: 42,
    fuelBurnPerSec: 0.2,
    fuelRegenPerSec: 0.12,
    rollImpulse: 100,
    rollInvulnSec: 0.25,
    rollCooldownSec: 3,
    rollFuelCost: 0.14,
    deflectChance: 0.08,
    ammo1Max: 800,
    ammo2Max: 6,
    radarRangeM: 1800,
    radius: 5.6,
    halfLength: 7.0,
    canHover: false,
    primary: 'pulse-blaster',
    secondary: 'seeker-pod',
    hotbar: [
      'mend-beam',
      'aegis-bubble',
      'rally-field',
      'overcharge',
      'purge',
      'flares',
      null,
      'repair-kit',
      'shield-kit',
      'fuel-cell',
    ],
  },
  bulwark: {
    id: 'bulwark',
    name: 'Bulwark',
    role: 'Armored gunship',
    maxHp: 2600,
    maxShield: 600,
    shieldRegenPerSec: 60,
    shieldRegenDelaySec: 5,
    minSpeed: 0,
    cruiseSpeed: 70,
    maxSpeed: 105,
    boostSpeed: 160,
    accel: 70,
    turnRate: 1.8,
    strafeSpeed: 36,
    verticalSpeed: 24,
    fuelBurnPerSec: 0.2,
    fuelRegenPerSec: 0.1,
    rollImpulse: 65,
    rollInvulnSec: 0.25,
    rollCooldownSec: 4,
    rollFuelCost: 0.2,
    deflectChance: 0.03,
    ammo1Max: 600,
    ammo2Max: 16,
    radarRangeM: 1400,
    radius: 6.8,
    halfLength: 8.0,
    canHover: true,
    primary: 'twin-autocannon',
    secondary: 'mortar-battery',
    hotbar: [
      'siege-anchor',
      'scrap-wall',
      'fortify',
      'barrage-calibration',
      'flares',
      null,
      null,
      'repair-kit',
      'shield-kit',
      'fuel-cell',
    ],
  },
};

/** Bulwark Siege Mode multipliers. */
export const SIEGE = { damageMul: 1.5, rangeMul: 1.4, turnRateMul: 0.6 };

/** Airborne Siege Mode (hover-locked in place): weaker than grounded. */
export const SIEGE_AIR = { damageMul: 1.15, rangeMul: 1.15, turnRateMul: 0.7, lockConeMul: 1.4 };

/**
 * Terrain impact above `minSpeed` (m/s into the surface): with shield up the Ship bounces,
 * the shield is emptied and `bounceHpFrac` of max HP is lost; with no shield the Ship is destroyed.
 */
export const TERRAIN_IMPACT = { minSpeed: 25, bounceHpFrac: 0.15, restitution: 0.6 };

/** Launch Deck behaviour. */
export const DECK = { dockMaxSpeed: 30, resupplySec: 2, launchSpeed: 60 };

export const RESPAWN_SEC = 5;

/**
 * Primary aim assist: if the selected Target is within `coneRad` of the Ship nose (centre crosshair) and in range,
 * Primary rounds are fired at the Target's lead point instead of straight down the aim line.
 */
export const AIM_ASSIST = { coneRad: 0.2, spreadMul: 0.5 };

/**
 * Missile evasion (the skill curve):
 * - lock cone is measured from the Ship's nose, not the cursor;
 * - a Barrel Roll started while a missile is within `rollBreakDistM` breaks its guidance (it overshoots);
 * - terrain between missile and target for `losBreakSec` breaks guidance; missiles hitting terrain explode;
 * - homing missiles get `endgameTurnMul` turn rate inside `endgameDistM` so straight flight is not enough.
 */
export const MISSILE_EVADE = {
  rollBreakDistM: 70,
  losBreakSec: 0.4,
  endgameDistM: 150,
  endgameTurnMul: 1.25,
};
