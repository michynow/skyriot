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
    maxSp: 300,
    spRegenPerSec: 2,
    strafeSpeed: 82,
    verticalSpeed: 75,
    lateralTauSec: 0.07,
    slipTauSec: 0.05,
    fuelBurnPerSec: 0.05, // a full tank = 20 s of boost
    fuelRegenPerSec: 0.05,
    rollImpulse: 120,
    rollInvulnSec: 1.1, // the spin (~94% of the visual rotation); the last of ROLL_DURATION_SEC is the settle
    rollCooldownSec: 3,
    deflectChance: 0.15,
    ammo1Max: 3600,
    ammo2Max: 320,
    radarRangeM: 2000,
    radarStdM: 1500,
    radarAdvM: 1620,
    radius: 4.4,
    halfLength: 6.0,
    canHover: false,
    primary: 'needle-cannon',
    secondary: 'sting-missile',
    hotbar: [
      // Bar 1: combat Skills
      'afterburn-dash',
      'pivot-flip',
      'backdraft',
      'roll-cascade',
      'blind-tag',
      'quiver-surge',
      'overdrive',
      'trim-tabs',
      null,
      null,
      // Bar 2: long buffs
      'gun-tune',
      'warhead-tune',
      'steady-hands',
      'hardened-hull',
      'jink-jets',
      null,
      null,
      null,
      null,
      null,
      // Bar 3: Consumables
      'repair-kit',
      'shield-kit',
      'sp-kit',
      'fuel-cell',
      null,
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
    role: 'Bomber',
    ...engineStats('mule-turbine'),
    maxHp: 1850,
    maxShield: 900,
    shieldRegenPerSec: 40,
    shieldRegenDelaySec: 5,
    maxSp: 300,
    spRegenPerSec: 2,
    strafeSpeed: 72,
    verticalSpeed: 66,
    lateralTauSec: 0.09,
    slipTauSec: 0.1,
    fuelBurnPerSec: 0.05, // a full tank = 20 s of boost
    fuelRegenPerSec: 0.05,
    rollImpulse: 105,
    rollInvulnSec: 1.1, // the spin (~94% of the visual rotation); the last of ROLL_DURATION_SEC is the settle
    rollCooldownSec: 3,
    deflectChance: 0.1,
    ammo1Max: 1500,
    ammo2Max: 100,
    radarRangeM: 1620,
    radarStdM: 1180,
    radarAdvM: 1070,
    radius: 7.2,
    halfLength: 10.0,
    canHover: false,
    primary: 'flak-repeater',
    secondary: 'brick-bomb',
    hotbar: [
      // Bar 1: combat Skills
      'air-barrage-mode',
      'ground-strike-mode',
      'wide-lock-mode',
      'overcharge-round',
      'pivot-flip',
      'backdraft',
      'chaff-screen',
      'shroud-veil',
      'core-breach',
      null,
      // Bar 2: long buffs
      'gun-tune',
      'warhead-tune',
      'steady-hands',
      'hardened-hull',
      'jink-jets',
      'shield-damper',
      null,
      null,
      null,
      null,
      // Bar 3: Consumables
      'repair-kit',
      'shield-kit',
      'sp-kit',
      'fuel-cell',
      null,
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
    maxHp: 2400,
    maxShield: 600,
    shieldRegenPerSec: 25,
    shieldRegenDelaySec: 4,
    maxSp: 400,
    spRegenPerSec: 3,
    strafeSpeed: 72,
    verticalSpeed: 63,
    lateralTauSec: 0.12,
    slipTauSec: 0.1,
    fuelBurnPerSec: 0.05, // a full tank = 20 s of boost
    fuelRegenPerSec: 0.05,
    rollImpulse: 110,
    rollInvulnSec: 1.1, // the spin (~94% of the visual rotation); the last of ROLL_DURATION_SEC is the settle
    rollCooldownSec: 3,
    deflectChance: 0.08,
    ammo1Max: 2400,
    ammo2Max: 320,
    radarRangeM: 2250,
    radarStdM: 1320,
    radarAdvM: 1430,
    radius: 5.6,
    halfLength: 7.0,
    canHover: false,
    primary: 'pulse-blaster',
    secondary: 'seeker-pod',
    hotbar: [
      // Bar 1: combat Skills
      'mend-beam',
      'charge-beam',
      'renewal-pulse',
      'recharge-pulse',
      'purge',
      'dispel-lance',
      'scan-pulse',
      'sanctum',
      'lifeline',
      'fuel-line',
      // Bar 2: long buffs
      'gun-tune',
      'warhead-tune',
      'steady-hands',
      'zenith-tune',
      'hardened-hull',
      'jink-jets',
      'rally-field',
      'ward-lattice',
      'veer-field',
      'thrift-circuit',
      // Bar 3: Consumables
      'repair-kit',
      'shield-kit',
      'sp-kit',
      'fuel-cell',
      'reverse-drive',
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
    maxHp: 2800,
    maxShield: 900,
    shieldRegenPerSec: 35,
    shieldRegenDelaySec: 5,
    maxSp: 300,
    spRegenPerSec: 2,
    strafeSpeed: 54,
    verticalSpeed: 36,
    lateralTauSec: 0.08,
    slipTauSec: 0.08,
    fuelBurnPerSec: 0.05, // a full tank = 20 s of boost
    fuelRegenPerSec: 0.05,
    rollImpulse: 65,
    rollInvulnSec: 1.1, // the spin (~94% of the visual rotation); the last of ROLL_DURATION_SEC is the settle
    rollCooldownSec: 3,
    deflectChance: 0.03,
    ammo1Max: 1800,
    ammo2Max: 192,
    radarRangeM: 1750,
    radarStdM: 1430,
    radarAdvM: 1680,
    radius: 6.8,
    halfLength: 8.0,
    canHover: true,
    primary: 'twin-autocannon',
    secondary: 'mortar-battery',
    hotbar: [
      // Bar 1: combat Skills
      'siege-anchor',
      'air-siege',
      'quake-round',
      'shield-weave',
      'blast-ward',
      'snare-tag',
      'shield-breaker',
      'siege-bastion',
      'track-drive',
      'ground-shroud',
      // Bar 2: long buffs
      'gun-tune',
      'warhead-tune',
      'steady-hands',
      'hardened-hull',
      'jink-jets',
      null,
      null,
      null,
      null,
      null,
      // Bar 3: Consumables
      'repair-kit',
      'shield-kit',
      'sp-kit',
      'fuel-cell',
      null,
      null,
      null,
      null,
      null,
      null,
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
export const TERRAIN_IMPACT = { minSpeed: 40, bounceHpFrac: 0.15, restitution: 0.6 };

/** Launch Deck behaviour. */
export const DECK = { dockMaxSpeed: 60, resupplySec: 2, launchSpeed: 110 };

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
  rollBreakDistM: 345,
  losBreakSec: 0.4,
  endgameDistM: 375,
  endgameTurnMul: 1.25,
};
