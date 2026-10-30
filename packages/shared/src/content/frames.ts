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
    minSpeed: 40,
    cruiseSpeed: 110,
    maxSpeed: 170,
    boostSpeed: 260,
    accel: 90,
    turnRate: 1.56,
    strafeSpeed: 45,
    verticalSpeed: 40,
    fuelBurnPerSec: 0.22,
    fuelRegenPerSec: 0.12,
    rollImpulse: 70,
    rollInvulnSec: 0.25,
    rollCooldownSec: 3,
    rollFuelCost: 0.12,
    deflectChance: 0.15,
    ammo1Max: 1200,
    ammo2Max: 8,
    radarRangeM: 1600,
    radius: 4.4,
    halfLength: 6.0,
    canHover: false,
    primary: 'needle-cannon',
    secondary: 'sting-missile',
    hotbar: ['afterburn-dash', 'ghost-skin', 'flares', null, null, null, null, 'repair-kit', 'shield-kit', 'fuel-cell'],
  },
  anvil: {
    id: 'anvil',
    name: 'Anvil',
    role: 'Heavy bomber',
    maxHp: 2200,
    maxShield: 700,
    shieldRegenPerSec: 70,
    shieldRegenDelaySec: 5,
    minSpeed: 30,
    cruiseSpeed: 75,
    maxSpeed: 115,
    boostSpeed: 170,
    accel: 45,
    turnRate: 0.66,
    strafeSpeed: 22,
    verticalSpeed: 22,
    fuelBurnPerSec: 0.18,
    fuelRegenPerSec: 0.1,
    rollImpulse: 40,
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
    hotbar: ['carpet-drop', 'iron-hide', 'flares', null, null, null, null, 'repair-kit', 'shield-kit', 'fuel-cell'],
  },
  halo: {
    id: 'halo',
    name: 'Halo',
    role: 'Support',
    maxHp: 1300,
    maxShield: 900,
    shieldRegenPerSec: 90,
    shieldRegenDelaySec: 3,
    minSpeed: 35,
    cruiseSpeed: 95,
    maxSpeed: 145,
    boostSpeed: 220,
    accel: 70,
    turnRate: 1.08,
    strafeSpeed: 34,
    verticalSpeed: 34,
    fuelBurnPerSec: 0.2,
    fuelRegenPerSec: 0.12,
    rollImpulse: 55,
    rollInvulnSec: 0.25,
    rollCooldownSec: 3,
    rollFuelCost: 0.14,
    deflectChance: 0.08,
    ammo1Max: 800,
    ammo2Max: 10,
    radarRangeM: 1800,
    radius: 5.6,
    halfLength: 7.0,
    canHover: false,
    primary: 'pulse-blaster',
    secondary: 'seeker-pod',
    hotbar: ['mend-beam', 'aegis-bubble', 'flares', null, null, null, null, 'repair-kit', 'shield-kit', 'fuel-cell'],
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
    cruiseSpeed: 55,
    maxSpeed: 85,
    boostSpeed: 130,
    accel: 40,
    turnRate: 0.78,
    strafeSpeed: 30,
    verticalSpeed: 18,
    fuelBurnPerSec: 0.2,
    fuelRegenPerSec: 0.1,
    rollImpulse: 35,
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
    hotbar: ['siege-anchor', 'scrap-wall', 'flares', null, null, null, null, 'repair-kit', 'shield-kit', 'fuel-cell'],
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
 * Primary aim assist: if the selected Target is within `coneRad` of the aim direction and in range,
 * Primary rounds are fired at the Target's lead point instead of straight down the aim line.
 */
export const AIM_ASSIST = { coneRad: 0.12, spreadMul: 0.5 };

/**
 * Missile evasion (the skill curve):
 * - lock cone is measured from the Ship's nose, not the cursor;
 * - a Barrel Roll started while a missile is within `rollBreakDistM` breaks its guidance (it overshoots);
 * - terrain between missile and target for `losBreakSec` breaks guidance; missiles hitting terrain explode;
 * - homing missiles get `endgameTurnMul` turn rate inside `endgameDistM` so straight flight is not enough.
 */
export const MISSILE_EVADE = { rollBreakDistM: 90, losBreakSec: 0.4, endgameDistM: 150, endgameTurnMul: 1.6 };
