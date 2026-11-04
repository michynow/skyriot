import type { FrameDef, FrameId } from '../types';
import { engineStats } from './engines';

// Starting tuning. Live-tweakable via the dev Leva panel; export new values back here.
/** Hotbar = HOTBAR_BARS bars of HOTBAR_BAR_SLOTS slots, flattened; slot index = bar * HOTBAR_BAR_SLOTS + key. */
export const HOTBAR_BAR_SLOTS = 10;
export const HOTBAR_BARS = 3;

export const FRAMES: Record<FrameId, FrameDef> = {
  wasp: {
    id: 'wasp',
    name: 'Wasp',
    role: 'Agile fighter',
    ...engineStats('kestrel-jet'),
    maxHp: 900,
    maxShield: 400,
    shieldRegenPerSec: 60,
    shieldRegenDelaySec: 4,
    strafeSpeed: 55,
    verticalSpeed: 50,
    lateralTauSec: 0.07,
    slipTauSec: 0.05,
    fuelBurnPerSec: 0.22,
    fuelRegenPerSec: 0.12,
    rollImpulse: 120,
    rollInvulnSec: 0.9,
    rollCooldownSec: 3,
    rollFuelCost: 0.12,
    deflectChance: 0.15,
    ammo1Max: 3600,
    ammo2Max: 320,
    radarRangeM: 1600,
    radius: 4.4,
    halfLength: 6.0,
    canHover: false,
    primary: 'needle-cannon',
    secondary: 'sting-missile',
    hotbar: [
      // Bar 1: core kit
      'afterburn-dash',
      'overdrive',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 2: Skill Kit
      'shroud-veil',
      'snare-tag',
      'hot-barrels',
      'quiver-surge',
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 3: shared utility
      'flares',
      'pivot-flip',
      'backdraft',
      'repair-kit',
      'shield-kit',
      null,
      null,
      null,
      null,
      null,
    ],
  },
  anvil: {
    id: 'anvil',
    name: 'Anvil',
    role: 'Heavy bomber',
    ...engineStats('mule-turbine'),
    maxHp: 2200,
    maxShield: 700,
    shieldRegenPerSec: 70,
    shieldRegenDelaySec: 5,
    strafeSpeed: 30,
    verticalSpeed: 22,
    lateralTauSec: 0.18,
    slipTauSec: 0.45,
    fuelBurnPerSec: 0.18,
    fuelRegenPerSec: 0.1,
    rollImpulse: 75,
    rollInvulnSec: 0.9,
    rollCooldownSec: 3,
    rollFuelCost: 0.18,
    deflectChance: 0.04,
    ammo1Max: 1500,
    ammo2Max: 36,
    radarRangeM: 1300,
    radius: 7.2,
    halfLength: 10.0,
    canHover: false,
    primary: 'flak-repeater',
    secondary: 'brick-bomb',
    hotbar: [
      // Bar 1: core kit
      'air-barrage-mode',
      'ground-strike-mode',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 2: Skill Kit
      'heavy-payload',
      'cinder-cloud',
      'ram-surge',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 3: shared utility
      'flares',
      'pivot-flip',
      'backdraft',
      'repair-kit',
      'shield-kit',
      null,
      null,
      null,
      null,
      null,
    ],
  },
  halo: {
    id: 'halo',
    name: 'Halo',
    role: 'Support',
    ...engineStats('lantern-drive'),
    maxHp: 1300,
    maxShield: 900,
    shieldRegenPerSec: 90,
    shieldRegenDelaySec: 3,
    strafeSpeed: 48,
    verticalSpeed: 42,
    lateralTauSec: 0.3,
    slipTauSec: 0.2,
    fuelBurnPerSec: 0.2,
    fuelRegenPerSec: 0.12,
    rollImpulse: 100,
    rollInvulnSec: 0.9,
    rollCooldownSec: 3,
    rollFuelCost: 0.14,
    deflectChance: 0.08,
    ammo1Max: 2400,
    ammo2Max: 320,
    radarRangeM: 1800,
    radius: 5.6,
    halfLength: 7.0,
    canHover: false,
    primary: 'pulse-blaster',
    secondary: 'seeker-pod',
    hotbar: [
      // Bar 1: core kit
      'rally-field',
      'purge',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 2: Skill Kit
      'ward-lattice',
      'renewal-pulse',
      'sapping-hex',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 3: shared utility
      'flares',
      'pivot-flip',
      'backdraft',
      'repair-kit',
      'shield-kit',
      null,
      null,
      null,
      null,
      null,
    ],
  },
  bulwark: {
    id: 'bulwark',
    name: 'Bulwark',
    role: 'Armored gunship',
    ...engineStats('crawler-rig'),
    maxHp: 2600,
    maxShield: 600,
    shieldRegenPerSec: 60,
    shieldRegenDelaySec: 5,
    strafeSpeed: 36,
    verticalSpeed: 24,
    lateralTauSec: 0.08,
    slipTauSec: 0.08,
    fuelBurnPerSec: 0.2,
    fuelRegenPerSec: 0.1,
    rollImpulse: 65,
    rollInvulnSec: 0.9,
    rollCooldownSec: 3,
    rollFuelCost: 0.2,
    deflectChance: 0.03,
    ammo1Max: 1800,
    ammo2Max: 48,
    radarRangeM: 1400,
    radius: 6.8,
    halfLength: 8.0,
    canHover: true,
    primary: 'twin-autocannon',
    secondary: 'mortar-battery',
    hotbar: [
      // Bar 1: core kit
      'siege-anchor',
      'air-siege',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 2: Skill Kit
      'bastion-field',
      'quake-round',
      'shrapnel-ring',
      'servo-overclock',
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 3: shared utility
      'flares',
      'pivot-flip',
      'backdraft',
      'repair-kit',
      'shield-kit',
      null,
      null,
      null,
      null,
      null,
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
export const DECK = { dockMaxSpeed: 40, resupplySec: 2, launchSpeed: 60 };

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
  rollBreakDistM: 140,
  losBreakSec: 0.4,
  endgameDistM: 150,
  endgameTurnMul: 1.25,
};
