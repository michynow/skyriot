import { DECK, SIEGE, SIEGE_AIR, TERRAIN_IMPACT } from '../content/frames';
import { sampleHeight } from '../terrain/heightfield';
import { TICK_HZ, type PilotInput, type ShipState } from '../types';
import type { ShipRec, SimCtx } from './ctx';
import {
  BANK_MAX_RAD,
  BANK_PER_STRAFE,
  BANK_PER_YAW_RATE,
  BANK_RATE_RAD,
  BOUNDARY_BLEND_M,
  BOUNDARY_MARGIN,
  BOUNDARY_SOFT_M,
  BOUNDARY_WARN_M,
  CEILING_PITCH_DOWN,
  CEILING_PUSH_SPEED,
  CEILING_SOFT_M,
  BRAKE_DECEL_MUL,
  CLIMB_SPEED_SHIFT,
  DECK_APPROACH_MUL,
  DOCK_CLEARANCE,
  DOCK_TOUCH_MARGIN,
  FLOOR_CLEARANCE,
  GROUND_CLEARANCE_EXTRA,
  GROUND_MAX_SLOPE_RAD,
  GROUND_NORMAL_SAMPLE_M,
  GROUND_NORMAL_TAU_SEC,
  GROUND_REVERSE_MUL,
  GROUND_SLIDE_SPEED,
  HOVER_GAIN,
  HOVER_CLEARANCE,
  HOVER_MAX_SPEED,
  LAND_HEIGHT,
  LANDING_ASSIST_HEIGHT,
  LATERAL_TAU_SEC,
  LAUNCH_KICK,
  LIFTOFF_KICK,
  ROLL_DISPLACEMENT_PER_IMPULSE,
  ROLL_DURATION_SEC,
  MIN_DIRECTION_LENGTH,
  SHIP_QUERY_GROUPS,
  SIEGE_LOCK_CONE_MUL,
  STALL_FALL_SECONDS,
  STALL_NOSE_DROP,
  STALL_DIVE_GAIN,
  STALL_GROUND_FADE_M,
  STALL_RECOVER_MUL,
  STALL_THRUST_MUL,
  STALL_TURN_MUL,
  THROTTLE_DECEL_MUL,
  TURN_GAIN,
  TURN_TAU_SEC,
} from './constants';
import { damageShip } from './damage';
import { clamp, forwardOf, quatFromBasis, rightOf, upOf, uprightFrame } from './math';

// Module-scope scratch: the flight code runs for every Ship every tick.
const _f0 = [0, 0, 0];
const _f1 = [0, 0, 0];
const _r0 = [0, 0, 0];
const _u0 = [0, 0, 0];
const _r1 = [0, 0, 0];
const _u1 = [0, 0, 0];
const _up = [0, 0, 0];
const _rr = [0, 0, 0];
const _uu = [0, 0, 0];
const _nn = [0, 0, 0];
const _vec = { x: 0, y: 0, z: 0 };
const _rot = { x: 0, y: 0, z: 0, w: 1 };
const _rv = [0, 0, 0];
const _move = { x: 0, y: 0, z: 0 };

/** Siege damage/range/turn multipliers for the Ship's current Siege mode (grounded vs airborne). */
export function siegeMods(s: ShipState): {
  damageMul: number;
  rangeMul: number;
  turnRateMul: number;
} {
  return s.grounded ? SIEGE : SIEGE_AIR;
}

/** Lock cone multiplier while sieged. */
export function siegeLockConeMul(s: ShipState): number {
  return s.grounded ? SIEGE_LOCK_CONE_MUL : SIEGE_AIR.lockConeMul;
}

/**
 * The siege-anchor Skill: leave Siege, enter it when grounded or slow, or (airborne and fast)
 * auto-brake until slow enough (`siegePending`). Using it again cancels a pending request.
 */
export function toggleSiege(rec: ShipRec): void {
  const s = rec.state;
  if (s.frame !== 'bulwark' || s.docked) return;
  if (s.sieged) s.sieged = false;
  else if (s.siegePending) s.siegePending = false;
  else if (s.grounded || s.speed < HOVER_MAX_SPEED) s.sieged = true;
  else s.siegePending = true;
}

/** Push body/collider to the ShipState transform. */
export function syncBody(ctx: SimCtx, rec: ShipRec): void {
  const s = rec.state;
  _vec.x = s.pos[0];
  _vec.y = s.pos[1];
  _vec.z = s.pos[2];
  rec.body.setTranslation(_vec, false);
  _rot.x = s.rot[0];
  _rot.y = s.rot[1];
  _rot.z = s.rot[2];
  _rot.w = s.rot[3];
  rec.body.setRotation(_rot, false);
  ctx.world.propagateModifiedBodyPositionsToColliders();
}

function resupply(ctx: SimCtx, s: ShipState): void {
  const fd = ctx.frames[s.frame];
  s.ammo1 = fd.ammo1Max;
  s.ammo2 = fd.ammo2Max;
  s.fuel = 1;
  s.shield = s.maxShield;
  ctx.events.push({ type: 'resupplied', id: s.id });
}

/** Own-nation deck whose surface the Ship is touching (or approaching, when `approach`). */
function ownDeck(ctx: SimCtx, s: ShipState, reach: number, radiusMul: number) {
  const decks = ctx.map.launchDecks[s.nation];
  for (let i = 0; i < decks.length; i++) {
    const d = decks[i]!;
    const dh = s.pos[1] - d.pos[1];
    if (dh < 0 || dh > reach) continue;
    const dx = s.pos[0] - d.pos[0],
      dz = s.pos[2] - d.pos[2];
    const r = d.radius * radiusMul;
    if (dx * dx + dz * dz <= r * r) return d;
  }
  return null;
}

/** Barrel Roll lateral velocity: a smooth half-sine bump whose integral is the roll displacement. */
function rollVelocity(
  fd: { rollImpulse: number },
  s: ShipState,
  fx: number,
  fz: number,
  out: number[],
): void {
  out[0] = out[1] = out[2] = 0;
  if (s.rollPhase < 0) return;
  const displacement = fd.rollImpulse * ROLL_DISPLACEMENT_PER_IMPULSE;
  const peak = (displacement * Math.PI) / (2 * ROLL_DURATION_SEC);
  const mag = s.rollDir * peak * Math.sin(Math.PI * s.rollPhase);
  const hx = -fz;
  const hl = Math.hypot(hx, fx) || 1;
  out[0] = (hx / hl) * mag;
  out[2] = (fx / hl) * mag;
}

/** Terrain normal (smoothed outside) at x/z into `out`. */
function terrainNormal(ctx: SimCtx, x: number, z: number, out: number[]): void {
  const h = GROUND_NORMAL_SAMPLE_M;
  const gx = (sampleHeight(ctx.hf, x + h, z) - sampleHeight(ctx.hf, x - h, z)) / (2 * h);
  const gz = (sampleHeight(ctx.hf, x, z + h) - sampleHeight(ctx.hf, x, z - h)) / (2 * h);
  const l = Math.hypot(gx, 1, gz);
  out[0] = -gx / l;
  out[1] = 1 / l;
  out[2] = -gz / l;
}

/**
 * The arcade flight integrator. Used identically by the authoritative step and by client
 * prediction (`stepLocal`); `allowDamage` only gates damage and events.
 */
export function stepFlight(
  ctx: SimCtx,
  rec: ShipRec,
  input: PilotInput,
  allowDamage: boolean,
): void {
  const s = rec.state;
  if (!s.alive) return;
  const dt = ctx.dt;
  const fd = ctx.frames[s.frame];
  const env = ctx.map.env;
  const space = env.kind === 'space';

  if (s.rollTicks > 0) s.rollTicks--;
  if (s.rollCooldownTicks > 0) s.rollCooldownTicks--;
  if (s.dashTicks > 0) s.dashTicks--;
  if (s.rollPhase >= 0) {
    s.rollPhase += dt / ROLL_DURATION_SEC;
    if (s.rollPhase >= 1) {
      s.rollPhase = -1;
      s.rollDir = 0;
    }
  }
  const edge = ctx.map.size / 2 - BOUNDARY_SOFT_M;
  const reach = Math.max(Math.abs(s.pos[0]), Math.abs(s.pos[2]));
  s.outOfBounds = reach > edge - BOUNDARY_WARN_M;

  // ---- Bulwark modes: landing, grounded, siege ----
  s.brakeHeld = input.brake;
  if (fd.canHover && !s.docked) {
    if (s.grounded) {
      if (input.vertical > 0 || input.boost) {
        s.grounded = false;
        s.sieged = false;
        s.siegePending = false;
        rec.lat[1] = LIFTOFF_KICK;
      }
    } else {
      const ground = sampleHeight(ctx.hf, s.pos[0], s.pos[2]);
      if (
        !s.sieged &&
        s.pos[1] - ground <= fd.radius + LAND_HEIGHT &&
        s.speed < fd.cruiseSpeed &&
        (input.brake || input.vertical < 0)
      ) {
        s.grounded = true;
        s.rollPhase = -1;
        s.rollDir = 0;
        rec.lat[1] = 0;
      }
    }
    if (s.siegePending && !s.sieged && (s.grounded || s.speed < HOVER_MAX_SPEED)) {
      s.sieged = true;
      s.siegePending = false;
    }
  }
  const grounded = s.grounded;
  const sieged = s.sieged;

  // ---- stall: hysteresis on last tick's speed; Bulwark hovers and the deck approach is exempt ----
  const winged = !space && !fd.canHover;
  const nearDeck = winged && ownDeck(ctx, s, LANDING_ASSIST_HEIGHT, DECK_APPROACH_MUL) !== null;
  if (!winged || s.docked || nearDeck || env.stallSpeed <= 0) s.stalled = false;
  else if (s.speed < env.stallSpeed) s.stalled = true;
  else if (s.speed > env.stallSpeed * STALL_RECOVER_MUL) s.stalled = false;

  // ---- orientation: ease the nose toward aim (angular velocity with time constant) ----
  forwardOf(s.rot, _f0);
  let ax = input.aim[0],
    ay = input.aim[1],
    az = input.aim[2];
  if (!s.docked) {
    const al0 = Math.hypot(ax, ay, az) || 1;
    ax /= al0;
    ay /= al0;
    az /= al0;
    if (reach > edge) {
      // Past the soft edge: steering is overridden, blending toward the map centre.
      const w = clamp((reach - edge) / BOUNDARY_BLEND_M, 0, 1);
      const cl = Math.hypot(s.pos[0], s.pos[2]) || 1;
      ax = ax * (1 - w) - (s.pos[0] / cl) * w;
      ay = ay * (1 - w);
      az = az * (1 - w) - (s.pos[2] / cl) * w;
    }
    const ceilK = clamp((s.pos[1] - (ctx.map.ceiling - CEILING_SOFT_M)) / CEILING_SOFT_M, 0, 1);
    if (ceilK > 0) ay = ay * (1 - ceilK) - ceilK * CEILING_PITCH_DOWN;
    if (s.stalled) {
      // Near the ground the nose stays up (belly-flop, thrust can still recover) instead of digging in.
      const agl = s.pos[1] - sampleHeight(ctx.hf, s.pos[0], s.pos[2]) - fd.radius;
      const drop = STALL_NOSE_DROP * clamp(agl / STALL_GROUND_FADE_M, 0, 1);
      ax *= 1 - drop;
      az *= 1 - drop;
      ay = ay * (1 - drop) - drop;
    }
  }
  if (s.docked || grounded) {
    ay = 0;
    const fl0 = Math.hypot(_f0[0]!, _f0[2]!);
    if (fl0 > MIN_DIRECTION_LENGTH) {
      _f0[0] = _f0[0]! / fl0;
      _f0[2] = _f0[2]! / fl0;
    } else {
      _f0[0] = 0;
      _f0[2] = -1;
    }
    _f0[1] = 0;
  }
  const alen = Math.hypot(ax, ay, az);
  if (alen > MIN_DIRECTION_LENGTH) {
    ax /= alen;
    ay /= alen;
    az /= alen;
  } else {
    ax = _f0[0]!;
    ay = _f0[1]!;
    az = _f0[2]!;
  }
  const maxRate =
    fd.turnRate *
    rec.mods.turnRateMul *
    (sieged ? siegeMods(s).turnRateMul : 1) *
    (s.stalled ? STALL_TURN_MUL : 1);
  const cosA = clamp(_f0[0]! * ax + _f0[1]! * ay + _f0[2]! * az, -1, 1);
  const angle = Math.acos(cosA);
  let cx = _f0[1]! * az - _f0[2]! * ay;
  let cy = _f0[2]! * ax - _f0[0]! * az;
  let cz = _f0[0]! * ay - _f0[1]! * ax;
  let cl = Math.hypot(cx, cy, cz);
  if (cl < 1e-6) {
    if (cosA < 0) {
      rightOf(s.rot, _rr);
      cx = _rr[0]!;
      cy = _rr[1]!;
      cz = _rr[2]!;
      cl = 1;
    } else {
      cl = 0;
    }
  }
  const desired = cl > 0 ? Math.min(angle * TURN_GAIN, maxRate) : 0;
  const kTurn = 1 - Math.exp(-dt / TURN_TAU_SEC);
  const w = s.angVel;
  const wdx = cl > 0 ? (cx / cl) * desired : 0;
  const wdy = cl > 0 ? (cy / cl) * desired : 0;
  const wdz = cl > 0 ? (cz / cl) * desired : 0;
  w[0] += (wdx - w[0]) * kTurn;
  w[1] += (wdy - w[1]) * kTurn;
  w[2] += (wdz - w[2]) * kTurn;
  const wdot = w[0] * _f0[0]! + w[1] * _f0[1]! + w[2] * _f0[2]!;
  w[0] -= wdot * _f0[0]!;
  w[1] -= wdot * _f0[1]!;
  w[2] -= wdot * _f0[2]!;
  let rate = Math.hypot(w[0], w[1], w[2]);
  if (rate > maxRate) {
    const sc = maxRate / rate;
    w[0] *= sc;
    w[1] *= sc;
    w[2] *= sc;
    rate = maxRate;
  }
  let theta = rate * dt;
  if (theta > angle) {
    // Never overshoot the aim.
    if (theta > 0) {
      const sc = angle / theta;
      w[0] *= sc;
      w[1] *= sc;
      w[2] *= sc;
    }
    theta = angle;
  }
  if (theta > 1e-9 && rate > 1e-9) {
    const nx = w[0] / rate,
      ny = w[1] / rate,
      nz = w[2] / rate;
    const c = Math.cos(theta),
      sn = Math.sin(theta);
    _f1[0] = _f0[0]! * c + (ny * _f0[2]! - nz * _f0[1]!) * sn;
    _f1[1] = _f0[1]! * c + (nz * _f0[0]! - nx * _f0[2]!) * sn;
    _f1[2] = _f0[2]! * c + (nx * _f0[1]! - ny * _f0[0]!) * sn;
  } else {
    _f1[0] = _f0[0]!;
    _f1[1] = _f0[1]!;
    _f1[2] = _f0[2]!;
  }
  const fl = Math.hypot(_f1[0]!, _f1[1]!, _f1[2]!);
  _f1[0] = _f1[0]! / fl;
  _f1[1] = _f1[1]! / fl;
  _f1[2] = _f1[2]! / fl;

  if (grounded) {
    // Heading from the turn above; pitch/roll follow the smoothed terrain normal.
    upOf(s.rot, _up);
    terrainNormal(ctx, s.pos[0], s.pos[2], _nn);
    const kn = 1 - Math.exp(-dt / GROUND_NORMAL_TAU_SEC);
    let ux = _up[0]! + (_nn[0]! - _up[0]!) * kn;
    let uy = _up[1]! + (_nn[1]! - _up[1]!) * kn;
    let uz = _up[2]! + (_nn[2]! - _up[2]!) * kn;
    const ul = Math.hypot(ux, uy, uz);
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const d = _f1[0]! * ux + _f1[1]! * uy + _f1[2]! * uz;
    let gx = _f1[0]! - d * ux,
      gy = _f1[1]! - d * uy,
      gz = _f1[2]! - d * uz;
    const gl = Math.hypot(gx, gy, gz);
    gx /= gl;
    gy /= gl;
    gz /= gl;
    _rr[0] = gy * uz - gz * uy;
    _rr[1] = gz * ux - gx * uz;
    _rr[2] = gx * uy - gy * ux;
    _uu[0] = _rr[1]! * gz - _rr[2]! * gy;
    _uu[1] = _rr[2]! * gx - _rr[0]! * gz;
    _uu[2] = _rr[0]! * gy - _rr[1]! * gx;
    _f1[0] = gx;
    _f1[1] = gy;
    _f1[2] = gz;
    quatFromBasis(_rr, _uu, _f1, s.rot);
  } else {
    uprightFrame(_f0, s.rot, _r0, _u0);
    upOf(s.rot, _up);
    const bank0 = Math.atan2(
      _up[0]! * _r0[0]! + _up[1]! * _r0[1]! + _up[2]! * _r0[2]!,
      _up[0]! * _u0[0]! + _up[1]! * _u0[1]! + _up[2]! * _u0[2]!,
    );
    const yawRate = (_f0[2]! * _f1[0]! - _f0[0]! * _f1[2]!) / dt;
    const bankTarget = clamp(
      -yawRate * BANK_PER_YAW_RATE + input.strafe * BANK_PER_STRAFE,
      -BANK_MAX_RAD,
      BANK_MAX_RAD,
    );
    const bank = s.docked
      ? 0
      : bank0 + clamp(bankTarget - bank0, -BANK_RATE_RAD * dt, BANK_RATE_RAD * dt);
    uprightFrame(_f1, s.rot, _r1, _u1);
    const cb = Math.cos(bank),
      sb = Math.sin(bank);
    for (let i = 0; i < 3; i++) {
      _rr[i] = _r1[i]! * cb - _u1[i]! * sb;
      _uu[i] = _u1[i]! * cb + _r1[i]! * sb;
    }
    quatFromBasis(_rr, _uu, _f1, s.rot);
  }

  // ---- docked: stationary, can turn, waits for launch ----
  if (s.docked) {
    s.speed = 0;
    rec.lat[0] = rec.lat[1] = rec.lat[2] = 0;
    s.vel[0] = s.vel[1] = s.vel[2] = 0;
    const need = Math.ceil(DECK.resupplySec * TICK_HZ);
    if (s.dockTicks < need) {
      s.dockTicks++;
      if (s.dockTicks === need) resupply(ctx, s);
    }
    if (input.launch) {
      s.docked = false;
      s.dockTicks = 0;
      s.speed = DECK.launchSpeed;
      rec.lat[1] = LAUNCH_KICK;
      ctx.events.push({ type: 'launched', id: s.id });
    } else {
      syncBody(ctx, rec);
      return;
    }
  }

  // ---- barrel roll ----
  if (
    (input.rollLeft || input.rollRight) &&
    s.rollCooldownTicks === 0 &&
    s.fuel >= fd.rollFuelCost &&
    s.rollPhase < 0 &&
    !sieged &&
    !grounded
  ) {
    const dir = input.rollLeft ? -1 : 1;
    s.rollPhase = 0;
    s.rollDir = dir;
    s.rollTicks = Math.ceil(fd.rollInvulnSec * TICK_HZ);
    s.rollCooldownTicks = Math.ceil(fd.rollCooldownSec * TICK_HZ);
    s.fuel -= fd.rollFuelCost;
    ctx.events.push({ type: 'barrelRoll', id: s.id, dir });
  }

  const kLat = 1 - Math.exp(-dt / LATERAL_TAU_SEC);
  const accel = fd.accel * dt;

  if (grounded) {
    // ---- ground drive ----
    terrainNormal(ctx, s.pos[0], s.pos[2], _nn);
    const steep = Math.acos(_nn[1]!) > GROUND_MAX_SLOPE_RAD;
    let target = 0;
    if (!sieged && !steep) {
      target =
        input.throttle >= 0
          ? input.throttle * fd.cruiseSpeed
          : input.throttle * fd.cruiseSpeed * GROUND_REVERSE_MUL;
      target *= rec.mods.speedMul;
    }
    const delta = target - s.speed;
    const rate2 = (Math.abs(target) < Math.abs(s.speed) ? BRAKE_DECEL_MUL : 1) * accel;
    s.speed += clamp(delta, -rate2, rate2);
    s.fuel = clamp(s.fuel + fd.fuelRegenPerSec * rec.mods.fuelRegenMul * dt, 0, 1);
    let tx = 0,
      tz = 0;
    if (steep) {
      const hl2 = Math.hypot(_nn[0]!, _nn[2]!) || 1;
      tx = (_nn[0]! / hl2) * GROUND_SLIDE_SPEED;
      tz = (_nn[2]! / hl2) * GROUND_SLIDE_SPEED;
    }
    // Grounded: no strafe (A/D does nothing); movement is W/S along the heading only.
    rec.lat[0] += (tx - rec.lat[0]) * kLat;
    rec.lat[1] = 0;
    rec.lat[2] += (tz - rec.lat[2]) * kLat;
    forwardOf(s.rot, _f1);
    const vx = _f1[0]! * s.speed + rec.lat[0];
    const vy = _f1[1]! * s.speed;
    const vz = _f1[2]! * s.speed + rec.lat[2];
    s.vel[0] = vx;
    s.vel[1] = vy;
    s.vel[2] = vz;
    const clearance = fd.radius + GROUND_CLEARANCE_EXTRA;
    const nx = s.pos[0] + vx * dt,
      nz = s.pos[2] + vz * dt;
    _move.x = vx * dt;
    _move.y = sampleHeight(ctx.hf, nx, nz) + clearance - s.pos[1];
    _move.z = vz * dt;
    ctx.controller.computeColliderMovement(rec.collider, _move, undefined, SHIP_QUERY_GROUPS);
    const m = ctx.controller.computedMovement();
    s.pos[0] += m.x;
    s.pos[2] += m.z;
    const lim = ctx.map.size / 2 - BOUNDARY_MARGIN;
    s.pos[0] = clamp(s.pos[0], -lim, lim);
    s.pos[2] = clamp(s.pos[2], -lim, lim);
    s.pos[1] = sampleHeight(ctx.hf, s.pos[0], s.pos[2]) + clearance;
    syncBody(ctx, rec);
    return;
  }

  // ---- forward speed ----
  let target: number;
  let boosting = false;
  if (sieged) {
    target = 0;
  } else if (input.brake || s.siegePending) {
    target = winged && !nearDeck ? fd.minSpeed : 0;
  } else {
    target =
      input.throttle >= 0
        ? fd.cruiseSpeed + (fd.maxSpeed - fd.cruiseSpeed) * input.throttle
        : fd.cruiseSpeed + (fd.cruiseSpeed - fd.minSpeed) * input.throttle;
    if (s.dashTicks > 0) {
      target = fd.boostSpeed;
    } else if (input.boost && s.fuel > 0) {
      target = fd.boostSpeed;
      boosting = true;
    }
    target *= rec.mods.speedMul;
  }
  if (winged && !nearDeck) target = Math.max(target - _f1[1]! * CLIMB_SPEED_SHIFT, 0);
  s.fuel = clamp(
    s.fuel + (boosting ? -fd.fuelBurnPerSec : fd.fuelRegenPerSec * rec.mods.fuelRegenMul) * dt,
    0,
    1,
  );
  const delta = target - s.speed;
  const rate2 =
    (delta >= 0
      ? 1
      : input.brake || s.siegePending || sieged
        ? BRAKE_DECEL_MUL
        : THROTTLE_DECEL_MUL) * accel;
  if (s.stalled) {
    // No lift: the engine barely helps, only diving (gravity along the nose) builds speed back.
    s.speed += clamp(delta, -rate2, rate2) * STALL_THRUST_MUL;
    s.speed = Math.max(s.speed - _f1[1]! * env.gravity * STALL_DIVE_GAIN * dt, 0);
  } else s.speed += clamp(delta, -rate2, rate2);

  // ---- lateral / vertical velocity ----
  const hrx = -_f1[2]!,
    hrz = _f1[0]!;
  const hrl = Math.hypot(hrx, hrz) || 1;
  let ty = input.vertical * fd.verticalSpeed;
  let tx = (hrx / hrl) * input.strafe * fd.strafeSpeed;
  let tz = (hrz / hrl) * input.strafe * fd.strafeSpeed;
  if (sieged) {
    // Airborne siege: hold position and altitude, no gravity.
    tx = 0;
    tz = 0;
    ty = 0;
  } else if (!space) {
    if (fd.canHover && s.speed < HOVER_MAX_SPEED) {
      if (input.vertical === 0) {
        const ground = sampleHeight(ctx.hf, s.pos[0], s.pos[2]);
        ty = clamp(
          (ground + fd.radius + HOVER_CLEARANCE - s.pos[1]) * HOVER_GAIN,
          -fd.verticalSpeed,
          fd.verticalSpeed,
        );
      }
    } else if (!fd.canHover && s.speed < env.stallSpeed) {
      ty -= env.gravity * STALL_FALL_SECONDS * (1 - s.speed / env.stallSpeed);
    }
  }
  const ceilPush = clamp((s.pos[1] - (ctx.map.ceiling - CEILING_SOFT_M)) / CEILING_SOFT_M, 0, 1);
  if (ceilPush > 0) ty = Math.min(ty, -ceilPush * CEILING_PUSH_SPEED);
  rec.lat[0] += (tx - rec.lat[0]) * kLat;
  rec.lat[1] += (ty - rec.lat[1]) * kLat;
  rec.lat[2] += (tz - rec.lat[2]) * kLat;

  // ---- move through the world ----
  rollVelocity(fd, s, _f1[0]!, _f1[2]!, _rv);
  const vx = _f1[0]! * s.speed + rec.lat[0] + _rv[0]!;
  const vy = _f1[1]! * s.speed + rec.lat[1];
  const vz = _f1[2]! * s.speed + rec.lat[2] + _rv[2]!;
  s.vel[0] = vx;
  s.vel[1] = vy;
  s.vel[2] = vz;
  const dx = vx * dt,
    dy = vy * dt,
    dz = vz * dt;
  _move.x = dx;
  _move.y = dy;
  _move.z = dz;
  // Collider still sits at the previous position (synced at end of last tick).
  ctx.controller.computeColliderMovement(rec.collider, _move, undefined, SHIP_QUERY_GROUPS);
  const m = ctx.controller.computedMovement();
  const lostX = dx - m.x,
    lostY = dy - m.y,
    lostZ = dz - m.z;
  const lost = Math.hypot(lostX, lostY, lostZ) / dt;
  s.pos[0] += m.x;
  s.pos[1] += m.y;
  s.pos[2] += m.z;

  // ---- Launch Deck docking (before impact so a slow landing is never an impact) ----
  const speedMag = Math.hypot(vx, vy, vz);
  if (speedMag < DECK.dockMaxSpeed) {
    const deck = ownDeck(ctx, s, fd.radius + DOCK_TOUCH_MARGIN, 1);
    if (deck) {
      s.docked = true;
      s.dockTicks = 0;
      s.speed = 0;
      s.sieged = false;
      s.siegePending = false;
      s.rollPhase = -1;
      s.rollDir = 0;
      s.pos[1] = deck.pos[1] + fd.radius + DOCK_CLEARANCE;
      rec.lat[0] = rec.lat[1] = rec.lat[2] = 0;
      s.vel[0] = s.vel[1] = s.vel[2] = 0;
      ctx.events.push({ type: 'docked', id: s.id });
      syncBody(ctx, rec);
      return;
    }
  }

  // ---- terrain impact: shield bounces, no shield destroys ----
  const gentle = fd.canHover && speedMag < fd.cruiseSpeed;
  if (lost > TERRAIN_IMPACT.minSpeed && !gentle) {
    // Surface normal = opposite of the removed motion.
    const ll = Math.hypot(lostX, lostY, lostZ);
    const nx = -lostX / ll,
      ny = -lostY / ll,
      nz = -lostZ / ll;
    const god = ctx.tuning.god.has(s.id);
    if (s.shield > 0 || god) {
      const vdn = vx * nx + vy * ny + vz * nz;
      if (vdn < 0) {
        const k = (1 + TERRAIN_IMPACT.restitution) * vdn;
        const bx = vx - k * nx,
          by = vy - k * ny,
          bz = vz - k * nz;
        s.speed = Math.max(bx * _f1[0]! + by * _f1[1]! + bz * _f1[2]!, 0);
        rec.lat[0] = bx - _f1[0]! * s.speed;
        rec.lat[1] = by - _f1[1]! * s.speed;
        rec.lat[2] = bz - _f1[2]! * s.speed;
      }
      let loss = 0;
      if (!god) {
        s.shield = 0;
        loss = TERRAIN_IMPACT.bounceHpFrac * s.maxHp;
        if (allowDamage) loss = damageShip(ctx, rec, loss, null);
        else s.hp = Math.max(s.hp - loss, 1);
      }
      if (allowDamage) {
        ctx.events.push({
          type: 'terrainImpact',
          id: s.id,
          damage: loss,
          pos: [s.pos[0], s.pos[1], s.pos[2]],
          bounced: true,
        });
      }
    } else if (allowDamage) {
      const dmg = s.hp;
      ctx.events.push({
        type: 'terrainImpact',
        id: s.id,
        damage: dmg,
        pos: [s.pos[0], s.pos[1], s.pos[2]],
        bounced: false,
      });
      damageShip(ctx, rec, dmg, null);
    }
  }

  // ---- hard limits ----
  const lim = ctx.map.size / 2 - BOUNDARY_MARGIN;
  s.pos[0] = clamp(s.pos[0], -lim, lim);
  s.pos[2] = clamp(s.pos[2], -lim, lim);
  const floor = sampleHeight(ctx.hf, s.pos[0], s.pos[2]) + FLOOR_CLEARANCE;
  if (s.pos[1] < floor) {
    s.pos[1] = floor;
    if (rec.lat[1] < 0) rec.lat[1] = 0;
  }
  if (s.pos[1] > ctx.map.ceiling) {
    s.pos[1] = ctx.map.ceiling;
    if (rec.lat[1] > 0) rec.lat[1] = 0;
  }
  syncBody(ctx, rec);
}

/** Recompute hidden lateral velocity after a state overwrite (reconciliation). */
export function deriveLateral(rec: ShipRec, fd: { rollImpulse: number }): void {
  forwardOf(rec.state.rot, _f0);
  rollVelocity(fd, rec.state, _f0[0]!, _f0[2]!, _rv);
  for (let i = 0; i < 3; i++) rec.lat[i] = rec.state.vel[i]! - _f0[i]! * rec.state.speed - _rv[i]!;
}
