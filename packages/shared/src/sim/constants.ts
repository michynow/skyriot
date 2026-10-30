// Sim-internal tuning constants. ponytail: move to content/ once the orchestrator agrees on shape.

/** Time constant (s) of lateral/vertical velocity blending; roll impulse decays over ~3x this. */
export const LATERAL_TAU_SEC = 0.1;
export const BRAKE_DECEL_MUL = 1.6;
export const BANK_MAX_RAD = 0.75;
export const BANK_RATE_RAD = 5;
/** Bank (rad) per rad/s of yaw rate. */
export const BANK_PER_YAW_RATE = 0.45;
export const BANK_PER_STRAFE = 0.3;
/** Terminal fall speed when fully stalled = gravity * this. */
export const STALL_FALL_SECONDS = 2;
export const HOVER_HEIGHT = 6;
export const HOVER_MAX_SPEED = 15;
export const HOVER_GAIN = 2;
export const KCC_OFFSET = 0.15;
/** Forward speed retained after a terrain impact. */
export const IMPACT_SPEED_RETAIN = 0.55;
export const FLOOR_CLEARANCE = 0.5;
export const BOUNDARY_MARGIN = 20;
export const TIMESCALE_MIN = 0.05;
export const TIMESCALE_MAX = 4;
export const MIN_DIRECTION_LENGTH = 1e-6;

// Interaction groups (membership << 16 | filter).
export const TERRAIN_GROUPS = (0x0001 << 16) | 0xffff;
export const SHIP_GROUPS = (0x0002 << 16) | 0x0001;
export const SHIP_QUERY_GROUPS = (0x0002 << 16) | 0x0001;
export const RAY_QUERY_GROUPS = (0x0001 << 16) | 0x0001;

// Weapons / projectiles
export const NOSE_OFFSET = 1;
export const PROJECTILE_RADIUS = 0.6;
export const DEFLECT_CAP = 0.15;
export const DEFLECT_DAMAGE_MUL = 0.5;
export const SPLASH_MIN_FRACTION = 0.25;
export const LAG_HISTORY_TICKS = 12;

// Skills
export const GHOST_DEFLECT_BONUS = 0.2;
export const IRON_HIDE_DAMAGE_MUL = 0.6;
export const REPAIR_KIT_FRACTION = 0.35;
export const FLARE_COUNT = 2;
export const FLARE_SPEED = 25;
export const FLARE_RANGE = 120;
export const CARPET_BOMBS = 5;
export const CARPET_SPACING = 14;
export const CARPET_DAMAGE_MUL = 0.45;
export const CARPET_BOMB_WEAPON = 'brick-bomb';
export const MEND_RANGE = 200;
export const MEND_CONE_RAD = 0.5;
export const MEND_HEAL_FRACTION = 0.3;
export const AEGIS_RADIUS = 60;
export const WALL_DISTANCE = 45;
export const WALL_RADIUS = 14;
export const WALL_MAX = 16;

// Steering smoothing
/** Desired turn rate = angle-to-aim * gain (capped at turnRate): eases out of turns. */
export const TURN_GAIN = 4;
/** Angular velocity blend time constant (s): eases into turns. */
export const TURN_TAU_SEC = 0.12;

// Launch Decks
export const DECK_HALF_THICKNESS = 1;
export const DOCK_TOUCH_MARGIN = 3;
export const DOCK_CLEARANCE = 0.3;
export const LAUNCH_KICK = 8;
/** Landing assist: braking within this horizontal factor of own deck radius and below this height lands. */
export const DECK_APPROACH_MUL = 4;
export const LANDING_ASSIST_HEIGHT = 120;
export const DECK_RESPAWN_SPREAD = 0.6;

// Bulwark ground mode
export const LAND_HEIGHT = 8;
export const GROUND_CLEARANCE_EXTRA = 2;
export const GROUND_STRAFE_MUL = 0.5;
export const GROUND_REVERSE_MUL = 0.5;
export const GROUND_MAX_SLOPE_RAD = (40 * Math.PI) / 180;
export const GROUND_SLIDE_SPEED = 25;
export const GROUND_NORMAL_TAU_SEC = 0.15;
export const GROUND_NORMAL_SAMPLE_M = 8;
export const LIFTOFF_KICK = 10;

// Siege mortar lock
export const MORTAR_LOCK_CONE_RAD = 0.2;
export const SIEGE_LOCK_CONE_MUL = 2;
export const MORTAR_LOCK_SEC = 1.2;
export const MORTAR_LOFT_RAD = 0.6;
export const MORTAR_GUIDE_TURN = 0.9;
