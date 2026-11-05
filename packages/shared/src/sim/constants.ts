// Sim-internal tuning constants. ponytail: move to content/ once the orchestrator agrees on shape.

export const BRAKE_DECEL_MUL = 1.6;
/** Easing off the throttle (S / release) slows at this fraction of accel: only Brake bleeds speed fast. */
export const THROTTLE_DECEL_MUL = 0.5;
export const BANK_MAX_RAD = 1.05;
export const BANK_RATE_RAD = 9;
/** Bank (rad) per rad/s of yaw rate. */
export const BANK_PER_YAW_RATE = 0.5;
export const BANK_PER_STRAFE = 0.35;
/** Below this speed an airborne Bulwark can enter Siege at once (faster: it brakes first). */
export const HOVER_MAX_SPEED = 15;
export const KCC_OFFSET = 0.15;
/** Forward speed retained after a terrain impact. */
export const IMPACT_SPEED_RETAIN = 0.55;
export const FLOOR_CLEARANCE = 0.5;
/** Hard clamp (last resort) sits this far inside the map edge. */
export const BOUNDARY_MARGIN = 20;
/** Steering override starts this far inside the map edge, blending to full over BOUNDARY_BLEND_M. */
export const BOUNDARY_SOFT_M = 450;
export const BOUNDARY_BLEND_M = 120;
/** outOfBounds (HUD warning) is set this far before the override starts. */
export const BOUNDARY_WARN_M = 200;
export const CEILING_SOFT_M = 150;
export const CEILING_PUSH_SPEED = 40;
export const CEILING_PITCH_DOWN = 0.5;
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
export const LAG_HISTORY_TICKS = 20; // > LAG_COMP_MAX_MS in ticks (18)

// Skills
export const REPAIR_KIT_FRACTION = 0.35;
/** Pivot Flip: the steering aim is turned 180 degrees and turn rate is raised to this for the duration. */
export const FLIP_TURN_RATE = 6.5;
/** Backdraft: fly backwards at this fraction of boost speed, then resume at min speed. */
export const REVERSE_SPEED_MUL = 0.7;
/** Shroud Veil: enemies closer than this still see (and can lock) a veiled Ship. */
export const CLOAK_REVEAL_M = 180;
export const SNARE_RANGE = 450;
export const SNARE_CONE_RAD = 0.35;
export const QUAKE_DISTANCE = 180;
export const QUAKE_RADIUS = 70;
export const QUAKE_DAMAGE = 600;
/** Core Breach blast radius (damage = the caster's HP). */
export const BREACH_RADIUS = 150;
/** Renewal / Recharge Pulse: radius, HP and shield restored (fractions of max). */
export const HEAL_FIELD_RADIUS = 200;
export const HEAL_FIELD_HP = 0.2;
export const HEAL_FIELD_SHIELD = 0.3;
/** Mend Beam / Lifeline reach, and Mend Beam heal (fraction of max HP). */
export const HEAL_BEAM_RANGE = 400;
export const HEAL_BEAM_HP = 0.3;
export const CHARGE_BEAM_SHIELD = 0.4;
export const DISPEL_RANGE = 600;
export const SCAN_RADIUS = 600;
export const DAMAGE_AURA_RADIUS = 55;

// Steering smoothing
/** Desired turn rate = angle-to-aim * gain (capped at turnRate): eases out of turns. */
export const TURN_GAIN = 9;
/** Angular velocity blend time constant (s): eases into turns. */
export const TURN_TAU_SEC = 0.06;
/** Turn rate gains/loses up to this fraction: +below cruise, −toward boost speed. */
export const TURN_SPEED_FALLOFF = 0.35;

// Launch Decks
export const DECK_HALF_THICKNESS = 1;
export const DOCK_TOUCH_MARGIN = 3;
export const DOCK_CLEARANCE = 0.3;
export const LAUNCH_KICK = 8;
export const DECK_RESPAWN_SPREAD = 0.6;

// Bulwark ground mode
export const LAND_HEIGHT = 8;
/** Landing autopilot (C): own Launch Deck must be within this horizontal range (m). */
export const LAND_DECK_RANGE = 2000;
/** Approach speed per metre to the Deck (capped at cruise), height above the Deck until over it. */
export const LAND_APPROACH_GAIN = 0.4;
export const LAND_APPROACH_HEIGHT = 30;
/** Vertical speed per metre of height error while landing (capped at the Frame's vertical speed). */
export const LAND_DESCENT_GAIN = 1;
/** Within this fraction of the Deck radius the nose holds its heading (no spinning over the pad). */
export const LAND_HOLD_HEADING_MUL = 0.5;
export const GROUND_CLEARANCE_EXTRA = 2;
export const GROUND_STRAFE_MUL = 0.5;
export const GROUND_REVERSE_MUL = 0.5;
export const GROUND_MAX_SLOPE_RAD = (40 * Math.PI) / 180;
export const GROUND_SLIDE_SPEED = 25;
export const GROUND_NORMAL_TAU_SEC = 0.15;
export const GROUND_NORMAL_SAMPLE_M = 8;
/** Bulwark lift-off (C while Grounded): climb at full vertical speed for this long. */
export const LIFTOFF_SEC = 1;

// Siege mortar lock
export const MORTAR_LOCK_CONE_RAD = 0.2;
export const SIEGE_LOCK_CONE_MUL = 2;
export const MORTAR_LOCK_SEC = 1.2;
// Siege gun lock: acquired inside AIM_ASSIST.coneRad of the nose, held until the Target leaves this cone.
export const SIEGE_GUN_BREAK_CONE_RAD = 0.5;
export const SIEGE_GUN_SPREAD_MUL = 0.35;
/** Gun-locked rounds home this hard (rad/s, effectively a direct track) and may fly this much past range. */
export const SIEGE_GUN_HOMING_TURN = 60;
export const SIEGE_GUN_RANGE_SLACK = 1.5;
/** Overcharge Round: the armed Primary shot flies this much farther. */
export const CHARGED_SHOT_RANGE_MUL = 2;
/** Rocket / bomb proximity fuse: bursts when a hull is within this fraction of the blast radius. */
export const ROCKET_FUSE_FRAC = 0.6;
export const MORTAR_LOFT_RAD = 0.6;
export const MORTAR_GUIDE_TURN = 0.9;

// Barrel Roll: displacement = rollImpulse * factor over ROLL_DURATION_SEC (half-sine velocity curve).
export const ROLL_DURATION_SEC = 1.1;
export const ROLL_DISPLACEMENT_PER_IMPULSE = 0.25;

// Frame core kits
export const AIR_BARRAGE_COUNT = 3;
export const AIR_BARRAGE_SPREAD_RAD = 0.035;
/** Each of the salvo's rockets deals this fraction of the Secondary's damage. */
export const AIR_BARRAGE_DAMAGE_MUL = 0.45;
export const GROUND_STRIKE_GROUND_MUL = 1.4;
export const GROUND_STRIKE_SPLASH_MUL = 1.3;
export const BOMB_DROP_SPEED = 20;
export const BOMB_GRAVITY = 30;
/** Missile Secondaries fire this many per trigger pull (each costs 1 ammo), fanned this far apart. */
export const MISSILE_SALVO = 2;
export const MISSILE_SALVO_SPREAD_RAD = 0.05;
export const PURGE_RADIUS = 120;

// Guided missile manoeuvring: lead pursuit plus a deterministic corkscrew weave (seeded by projectile id).
export const NAV_MAX_LEAD_SEC = 5;
export const WEAVE_PERIOD_MIN_SEC = 0.6;
export const WEAVE_PERIOD_SPAN_SEC = 0.3;
export const WEAVE_AMP_MIN_M = 3;
export const WEAVE_AMP_SPAN_M = 2;
export const WEAVE_RAMP_SEC = 0.3;
export const ROCKET_WOBBLE_AMP_M = 1.2;
export const ROCKET_WOBBLE_PERIOD_SEC = 0.5;

// Guided missile limits (what makes them beatable by flying).
/** Seeker half-angle: the target leaving this cone off the missile's nose = lock lost, missile goes dumb. */
export const SEEKER_CONE_RAD = 0.6;
/** Guidance only while the motor burns; afterwards the missile flies on dumb until its range runs out. */
export const MISSILE_MOTOR_SEC = 5;
/** Proximity fuse: a guided missile still tracking detonates this close to its target's hull (direct hit). */
export const MISSILE_FUSE_M = 8;
/**
 * A target pulling at least this lateral acceleration (speed * turn rate, m/s^2) while the missile is in its
 * endgame out-turns it. Wasp manages it at cruise, Halo needs throttle, Anvil/Bulwark only while boosting.
 */
export const BREAK_TURN_ACCEL = 230;
