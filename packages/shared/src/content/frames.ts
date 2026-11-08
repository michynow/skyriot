import type { FrameDef, FrameId } from '../types';
import { engineStats } from './engines';

// Starting tuning. Live-tweakable via the dev Leva panel; export new values back here.
/**
 * Hotbar = HOTBAR_BARS bars of HOTBAR_BAR_SLOTS slots, flattened; slot index = bar * HOTBAR_BAR_SLOTS + key.
 * `FrameDef.hotbar` below is only the default layout (new Pilots, Bots); a Pilot's own layout is `Loadout.hotbar`.
 */
export const HOTBAR_BAR_SLOTS = 10;
export const HOTBAR_BARS = 3;

export const FRAMES: Record<FrameId, FrameDef> = {
  wasp: {
    id: 'wasp',
    name: 'Wasp',
    role: 'Agile fighter',
    ...engineStats('kestrel-jet'),
    maxHp: 2100,
    maxShield: 800,
    shieldRegenPerSec: 35,
    shieldRegenDelaySec: 4,
    strafeSpeed: 110,
    verticalSpeed: 100,
    lateralTauSec: 0.07,
    slipTauSec: 0.05,
    fuelBurnPerSec: 0.22,
    fuelRegenPerSec: 0.12,
    rollImpulse: 120,
    rollInvulnSec: 1.1, // = ROLL_DURATION_SEC: invulnerable for the whole visible roll
    rollCooldownSec: 3,
    rollFuelCost: 0.12,
    deflectChance: 0.15,
    ammo1Max: 3600,
    ammo2Max: 320,
    radarRangeM: 2400,
    radarStdM: 1800,
    radarAdvM: 1950,
    radius: 4.4,
    halfLength: 6.0,
    canHover: false,
    primary: 'needle-cannon',
    secondary: 'sting-missile',
    hotbar: [
      // Bar 1: core kit
      'afterburn-dash',
      'overdrive',
      'quiver-surge',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 2: Skill Kit
      'trim-tabs',
      'roll-cascade',
      'shield-damper',
      'blind-tag',
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 3: shared (turns, buffs, consumables)
      'pivot-flip',
      'backdraft',
      'repair-kit',
      'shield-kit',
      'fuel-cell',
      'gun-tune',
      'warhead-tune',
      'steady-hands',
      'hardened-hull',
      'jink-jets',
    ],
  },
  anvil: {
    id: 'anvil',
    name: 'Anvil',
    role: 'Bomber',
    ...engineStats('mule-turbine'),
    maxHp: 1850,
    maxShield: 900,
    shieldRegenPerSec: 40,
    shieldRegenDelaySec: 5,
    strafeSpeed: 96,
    verticalSpeed: 88,
    lateralTauSec: 0.09,
    slipTauSec: 0.1,
    fuelBurnPerSec: 0.18,
    fuelRegenPerSec: 0.1,
    rollImpulse: 105,
    rollInvulnSec: 1.1, // = ROLL_DURATION_SEC: invulnerable for the whole visible roll
    rollCooldownSec: 3,
    rollFuelCost: 0.14,
    deflectChance: 0.1,
    ammo1Max: 1500,
    ammo2Max: 100,
    radarRangeM: 1950,
    radarStdM: 1420,
    radarAdvM: 1280,
    radius: 7.2,
    halfLength: 10.0,
    canHover: false,
    primary: 'flak-repeater',
    secondary: 'brick-bomb',
    hotbar: [
      // Bar 1: core kit
      'air-barrage-mode',
      'ground-strike-mode',
      'overcharge-round',
      'wide-lock-mode',
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 2: Skill Kit
      'chaff-screen',
      'shroud-veil',
      'shield-damper',
      'core-breach',
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 3: shared (turns, buffs, consumables)
      'pivot-flip',
      'backdraft',
      'repair-kit',
      'shield-kit',
      'fuel-cell',
      'gun-tune',
      'warhead-tune',
      'steady-hands',
      'hardened-hull',
      'jink-jets',
    ],
  },
  halo: {
    id: 'halo',
    name: 'Halo',
    role: 'Support',
    ...engineStats('lantern-drive'),
    maxHp: 2400,
    maxShield: 600,
    shieldRegenPerSec: 25,
    shieldRegenDelaySec: 4,
    strafeSpeed: 96,
    verticalSpeed: 84,
    lateralTauSec: 0.12,
    slipTauSec: 0.1,
    fuelBurnPerSec: 0.2,
    fuelRegenPerSec: 0.12,
    rollImpulse: 110,
    rollInvulnSec: 1.1, // = ROLL_DURATION_SEC: invulnerable for the whole visible roll
    rollCooldownSec: 3,
    rollFuelCost: 0.14,
    deflectChance: 0.08,
    ammo1Max: 2400,
    ammo2Max: 320,
    radarRangeM: 2700,
    radarStdM: 1580,
    radarAdvM: 1720,
    radius: 5.6,
    halfLength: 7.0,
    canHover: false,
    primary: 'pulse-blaster',
    secondary: 'seeker-pod',
    hotbar: [
      // Bar 1: core kit
      'rally-field',
      'ward-lattice',
      'veer-field',
      'renewal-pulse',
      'recharge-pulse',
      'mend-beam',
      'charge-beam',
      'lifeline',
      null,
      null,
      // Bar 2: Skill Kit
      'sanctum',
      'purge',
      'dispel-lance',
      'scan-pulse',
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 3: shared (turns, buffs, consumables)
      'pivot-flip',
      'backdraft',
      'repair-kit',
      'shield-kit',
      'fuel-cell',
      'gun-tune',
      'warhead-tune',
      'steady-hands',
      'hardened-hull',
      'jink-jets',
    ],
  },
  bulwark: {
    id: 'bulwark',
    name: 'Bulwark',
    role: 'Armored gunship',
    ...engineStats('crawler-rig'),
    maxHp: 2800,
    maxShield: 900,
    shieldRegenPerSec: 35,
    shieldRegenDelaySec: 5,
    strafeSpeed: 72,
    verticalSpeed: 48,
    lateralTauSec: 0.08,
    slipTauSec: 0.08,
    fuelBurnPerSec: 0.2,
    fuelRegenPerSec: 0.1,
    rollImpulse: 65,
    rollInvulnSec: 1.1, // = ROLL_DURATION_SEC: invulnerable for the whole visible roll
    rollCooldownSec: 3,
    rollFuelCost: 0.2,
    deflectChance: 0.03,
    ammo1Max: 1800,
    ammo2Max: 192,
    radarRangeM: 2100,
    radarStdM: 1720,
    radarAdvM: 2020,
    radius: 6.8,
    halfLength: 8.0,
    canHover: true,
    primary: 'twin-autocannon',
    secondary: 'mortar-battery',
    hotbar: [
      // Bar 1: core kit
      'siege-anchor',
      'air-siege',
      'quake-round',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      // Bar 2: Skill Kit
      'blast-ward',
      'shield-weave',
      'snare-tag',
      'shield-breaker',
      'track-drive',
      'ground-shroud',
      'crash-frame',
      null,
      null,
      null,
      // Bar 3: shared (turns, buffs, consumables)
      'pivot-flip',
      'backdraft',
      'repair-kit',
      'shield-kit',
      'fuel-cell',
      'gun-tune',
      'warhead-tune',
      'steady-hands',
      'hardened-hull',
      'jink-jets',
    ],
  },
};

/** Bulwark Siege Mode multipliers. damageTakenMul = the built-in siege armour (takes 25% less damage). */
export const SIEGE = {
  damageMul: 1.5,
  /** Primary reattack runs this many times faster (Ground Siege outguns Air Siege). */
  fireRateMul: 2.5,
  rangeMul: 1.4,
  turnRateMul: 0.6,
  damageTakenMul: 0.75,
  /** Primary rounds can't hit a Target closer than this (m). */
  minRangeM: 100,
  /** After entering either Siege the Primary holds fire this long (s). */
  armSec: 0.5,
};

/** Airborne Siege Mode (hover-locked in place): weaker than grounded. */
export const SIEGE_AIR = {
  damageMul: 1.15,
  fireRateMul: 1.6,
  rangeMul: 1.15,
  turnRateMul: 0.7,
  lockConeMul: 1.4,
  damageTakenMul: 0.85,
  /** The hovering gun can't depress: a Target more than this far (rad) below the horizon can't be hit. */
  maxDepressionRad: 0.6,
};

/**
 * Terrain impact above `minSpeed` (m/s into the surface): with shield up the Ship bounces,
 * the shield is emptied and `bounceHpFrac` of max HP is lost; with no shield the Ship is destroyed.
 */
export const TERRAIN_IMPACT = { minSpeed: 50, bounceHpFrac: 0.15, restitution: 0.6 };

/** Launch Deck behaviour. */
export const DECK = { dockMaxSpeed: 60, resupplySec: 2, launchSpeed: 150 };

export const RESPAWN_SEC = 5;

/**
 * Primary aim assist: if the selected Target is within `coneRad` of the Ship nose (centre crosshair) and in range,
 * Primary rounds are fired at the Target's lead point instead of straight down the aim line.
 */
export const AIM_ASSIST = { coneRad: 0.2, spreadMul: 0.5 };

/**
 * Targeting rules (server-side): the Primary resolves each round as an accuracy roll against the selected Target
 * if it is inside STD radar and within `stdConeRad` of the nose; beyond the weapon's range the hit chance falls
 * by `falloffBase` per percent of range (capped at 1). Damage varies by +-`damageSpread`. Continuous fire overheats
 * after the weapon's overheatSec; heat bleeds off in `coolMul` x overheatSec (the forced cool-down when overheated takes OVERHEAT_COOL_MUL times longer).
 * Locks get the lag tolerance: +`lockToleranceDeg` Valid Angle, +`rangeTolerance` range. Series volleys are
 * `seriesSec` apart; a missed round flies at least `missSpreadRad` off the Target.
 */
export const TARGETING = {
  stdConeRad: 0.35,
  falloffBase: 0.983,
  damageSpread: 0.125,
  coolMul: 0.75,
  lockToleranceDeg: 1,
  rangeTolerance: 0.02,
  seriesSec: 0.2,
  missSpreadRad: 0.025,
};

/**
 * Missile evasion (the skill curve):
 * - lock cone is measured from the Ship's nose, not the cursor;
 * - a Barrel Roll started while a missile is within `rollBreakDistM` breaks its guidance (it overshoots);
 * - terrain between missile and target for `losBreakSec` breaks guidance; missiles hitting terrain explode;
 * - homing missiles get `endgameTurnMul` turn rate inside `endgameDistM` so straight flight is not enough.
 */
export const MISSILE_EVADE = {
  rollBreakDistM: 460,
  losBreakSec: 0.4,
  endgameDistM: 500,
  endgameTurnMul: 1.25,
};
