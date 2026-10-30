import type { StructureKind } from '../types';

/** Physical size and toughness per structure kind. Colliders are upright cylinders standing on `pos`. */
export const STRUCTURES: Record<StructureKind, { maxHp: number; radius: number; height: number }> =
  {
    core: { maxHp: 15000, radius: 36, height: 60 },
    shieldStation: { maxHp: 4000, radius: 12, height: 40 },
    turret: { maxHp: 1500, radius: 6, height: 14 },
  };

export const TURRET = {
  weapon: 'turret-flak',
  /** Barrel slew rate (rad/s): a Ship crossing fast at close range outruns it. */
  turnRateRad: 1.1,
  /** Fires only when the barrel is this close (rad) to the lead point. */
  fireConeRad: 0.06,
  /** Muzzle distance from the pivot (top of the turret), outside its own collider. */
  muzzleM: 10,
};

export const LAUNCH = {
  /** Death to hangar. */
  respawnSec: 2,
  /** A tunnel takes its next Ship this long after staging the previous one. */
  tunnelCooldownSec: 4,
  /** Platform carries the Ship onto the catapult, doors open, lights run outward. */
  stagingSec: 2.5,
  /** Catapult charged: a human who never presses W is fired anyway after this. */
  readyTimeoutSec: 5,
  /** Throttle input that fires the catapult. */
  readyThrottle: 0.9,
  /** Hangar sits this far below the Core's ground level (hidden). */
  hangarDepthM: 25,
};

/** Bots joining a Map Instance or starting a Battle skip the queue and start flying in rows ahead of their Base. */
export const FORMATION = {
  perRow: 5,
  /** First row this far ahead of the Core, next rows further out. */
  aheadM: 320,
  rowSpacingM: 80,
  columnSpacingM: 60,
  /** Height above the Core, and the least clearance over the ground below. */
  altitudeM: 150,
  minClearanceM: 100,
};

export const SHIELD_DOME = {
  /** Enemy Ship touching the dome is put back outside it with this outward speed. */
  bounceSpeed: 60,
  marginM: 2,
};

export const BATTLE = {
  /** Core down to Bases rebuilt and the next Battle. */
  restartSec: 15,
};
