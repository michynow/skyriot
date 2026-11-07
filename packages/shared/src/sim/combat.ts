import { AIM_ASSIST, MISSILE_EVADE, SIEGE, SIEGE_AIR, TARGETING } from '../content/frames';
import { STRUCTURE_ARMOR } from '../content/bases';
import { WEAPONS } from '../content/weapons';
import { siegeLockConeMul, siegeMods } from './flight';
import {
  LAG_COMP_MAX_MS,
  TICK_HZ,
  type PilotInput,
  type WeaponDef,
  type ProjectileKind,
  type NationId,
  type ShipId,
  type ShipState,
} from '../types';
import type { Projectile, ShipRec, SimCtx, StructureRec } from './ctx';
import {
  LAG_HISTORY_TICKS,
  AIR_BARRAGE_COUNT,
  AIR_BARRAGE_DAMAGE_MUL,
  AIR_BARRAGE_SPREAD_RAD,
  AIR_BARRAGE_SPLASH_MUL,
  GROUND_STRIKE_COUNT,
  GROUND_STRIKE_DAMAGE_MUL,
  GROUND_STRIKE_SPREAD_MPS,
  BOMB_DROP_SPEED,
  BOMB_GRAVITY,
  BOMB_FORWARD_KICK,
  AIR_BARRAGE_RANGE_MUL,
  BOMB_RANGE_MUL,
  BOMBING_REATTACK_MUL,
  MISSILE_SALVO_SPREAD_RAD,
  GROUND_STRIKE_GROUND_MUL,
  GROUND_STRIKE_SPLASH_MUL,
  NAV_MAX_LEAD_SEC,
  ROCKET_WOBBLE_AMP_M,
  ROCKET_WOBBLE_PERIOD_SEC,
  SEEKER_CONE_RAD,
  BREAK_TURN_ACCEL,
  MISSILE_FUSE_M,
  MISSILE_MOTOR_SEC,
  WEAVE_AMP_MIN_M,
  WEAVE_AMP_SPAN_M,
  WEAVE_PERIOD_MIN_SEC,
  WEAVE_PERIOD_SPAN_SEC,
  WEAVE_RAMP_SEC,
  SIEGE_GUN_BREAK_CONE_RAD,
  CHARGED_SHOT_RANGE_MUL,
  CLOAK_REVEAL_M,
  ROCKET_FUSE_FRAC,
  NOSE_OFFSET,
  OVERHEAT_COOL_MUL,
  PROJECTILE_RADIUS,
  RAY_QUERY_GROUPS,
  SPLASH_MIN_FRACTION,
  WIDE_LOCK_CONE_ADD_RAD,
  WIDE_LOCK_DAMAGE_MUL,
  WIDE_LOCK_HOMING_TURN,
  WIDE_LOCK_RANGE_MUL,
  WIDE_LOCK_TARGETS,
} from './constants';
import { breakCloak, dropBuffs } from './buffs';
import { hitShip } from './damage';
import { damageStructure, domeEntry, domeHitCore, splashStructures } from './structures';
import { forwardOf, rightOf, upOf } from './math';

const NO_SHIPS: ShipRec[] = [];
const MAX_REWIND_TICKS = Math.floor((LAG_COMP_MAX_MS / 1000) * TICK_HZ);
const _f = [0, 0, 0];
const _r = [0, 0, 0];
const _u = [0, 0, 0];

// Result registers for segment/capsule tests.
let _cx = 0,
  _cy = 0,
  _cz = 0,
  _cfx = 0,
  _cfy = 0,
  _cfz = 0,
  _s = 0;

/** Record each Ship's pose for lag compensation. Call once per tick after movement. */
export function pushHistory(ctx: SimCtx): void {
  const slot = ctx.tick % LAG_HISTORY_TICKS;
  for (const rec of ctx.recList) {
    forwardOf(rec.state.rot, _f);
    const o = slot * 6;
    rec.histPos[o] = rec.state.pos[0];
    rec.histPos[o + 1] = rec.state.pos[1];
    rec.histPos[o + 2] = rec.state.pos[2];
    rec.histPos[o + 3] = _f[0]!;
    rec.histPos[o + 4] = _f[1]!;
    rec.histPos[o + 5] = _f[2]!;
    rec.histTick[slot] = ctx.tick;
  }
}

function poseAt(ctx: SimCtx, rec: ShipRec, tick: number): void {
  const slot = tick % LAG_HISTORY_TICKS;
  if (tick < ctx.tick && rec.histTick[slot] === tick) {
    const o = slot * 6;
    _cx = rec.histPos[o]!;
    _cy = rec.histPos[o + 1]!;
    _cz = rec.histPos[o + 2]!;
    _cfx = rec.histPos[o + 3]!;
    _cfy = rec.histPos[o + 4]!;
    _cfz = rec.histPos[o + 5]!;
    return;
  }
  forwardOf(rec.state.rot, _f);
  _cx = rec.state.pos[0];
  _cy = rec.state.pos[1];
  _cz = rec.state.pos[2];
  _cfx = _f[0]!;
  _cfy = _f[1]!;
  _cfz = _f[2]!;
}

/** Closest approach of segment p->q to the capsule axis of a Ship pose. Sets _s = param on p->q. */
function segmentCapsuleDist2(
  px: number,
  py: number,
  pz: number,
  qx: number,
  qy: number,
  qz: number,
  half: number,
): number {
  const ax = _cx - _cfx * half,
    ay = _cy - _cfy * half,
    az = _cz - _cfz * half;
  const d2x = _cfx * half * 2,
    d2y = _cfy * half * 2,
    d2z = _cfz * half * 2;
  const d1x = qx - px,
    d1y = qy - py,
    d1z = qz - pz;
  const rx = px - ax,
    ry = py - ay,
    rz = pz - az;
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  const c = d1x * rx + d1y * ry + d1z * rz;
  let s: number, t: number;
  if (a <= 1e-9 && e <= 1e-9) {
    s = 0;
    t = 0;
  } else if (a <= 1e-9) {
    s = 0;
    t = Math.min(Math.max(f / e, 0), 1);
  } else if (e <= 1e-9) {
    t = 0;
    s = Math.min(Math.max(-c / a, 0), 1);
  } else {
    const b = d1x * d2x + d1y * d2y + d1z * d2z;
    const denom = a * e - b * b;
    s = denom > 1e-9 ? Math.min(Math.max((b * f - c * e) / denom, 0), 1) : 0;
    t = (b * s + f) / e;
    if (t < 0) {
      t = 0;
      s = Math.min(Math.max(-c / a, 0), 1);
    } else if (t > 1) {
      t = 1;
      s = Math.min(Math.max((b - c) / a, 0), 1);
    }
  }
  _s = s;
  const ex = px + d1x * s - (ax + d2x * t);
  const ey = py + d1y * s - (ay + d2y * t);
  const ez = pz + d1z * s - (az + d2z * t);
  return ex * ex + ey * ey + ez * ez;
}

export function spawnProjectile(
  ctx: SimCtx,
  /** A Ship, or a Turret's `shooter`. */
  owner: { state: { id: ShipId; nation: NationId } },
  kind: ProjectileKind,
  weapon: string,
  damage: number,
  splash: number,
  speed: number,
  range: number,
  homing: number,
  target: ShipId | null,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  rewind: number,
): Projectile {
  const p: Projectile = ctx.pool.pop() ?? ({} as Projectile);
  p.id = ctx.nextProjectileId++;
  p.owner = owner.state.id;
  p.nation = owner.state.nation;
  p.kind = kind;
  p.weapon = weapon;
  p.damage = damage;
  p.splash = splash;
  p.speed = speed;
  p.range = range;
  p.travelled = 0;
  p.x = x;
  p.y = y;
  p.z = z;
  p.dx = dx;
  p.dy = dy;
  p.dz = dz;
  p.homing = homing;
  p.target = target;
  p.spawnTick = ctx.tick;
  p.rewind = rewind;
  p.losTime = 0;
  p.gravity = 0;
  p.groundMul = 1;
  p.core = 0;
  p.structMul = 1;
  p.weaveAmp = 0;
  p.visual = false;
  p.strike = null;
  p.strikeAt = 0;
  p.warned = false;
  ctx.projectiles.push(p);
  ctx.events.push({
    type: 'projectileSpawned',
    id: p.id,
    owner: p.owner,
    kind,
    weapon,
    origin: [x, y, z],
    dir: [dx, dy, dz],
    speed,
    target,
    tick: ctx.tick,
  });
  return p;
}

const DEG = Math.PI / 180;
const _tp = [0, 0, 0];
const ZERO = [0, 0, 0] as const;

/**
 * A lock-on candidate by id: a live, uncloaked Ship or a live Base structure (aimed at its mid-height).
 * Writes its aim point into `_tp`; null if it can't be locked.
 */
function lockable(ctx: SimCtx, id: string): { id: string; nation: NationId } | null {
  const sh = ctx.ships.get(id);
  if (sh) {
    const s = sh.state;
    if (!s.alive || s.launchPhase !== 'none' || sh.mods.cloak) return null;
    _tp[0] = s.pos[0];
    _tp[1] = s.pos[1];
    _tp[2] = s.pos[2];
    return s;
  }
  const st = structureById(ctx, id);
  if (!st || !st.state.alive) return null;
  _tp[0] = st.state.pos[0];
  _tp[1] = st.state.pos[1] + st.height / 2;
  _tp[2] = st.state.pos[2];
  return st.state;
}

function structureById(ctx: SimCtx, id: string): StructureRec | undefined {
  // ponytail: linear scan over ~16 structures; index by id if Bases grow.
  for (const st of ctx.structures) if (st.state.id === id) return st;
  return undefined;
}

/** Structures shrug off gunfire (see STRUCTURE_ARMOR). */
function structureDamage(p: Projectile): number {
  return (p.kind === 'tracer' ? p.damage * STRUCTURE_ARMOR.tracerMul : p.damage) * p.structMul;
}

/**
 * The Secondary as the active bombing mode shapes it. Wide Lock Mode widens the Valid Angle and stretches lock and
 * flight range. Shared with the client HUD so its lock ring matches.
 */
export function bombingSecondary(w: WeaponDef, mode: string | undefined): WeaponDef {
  if (mode !== 'wide-lock-mode') return w;
  const validAngleDeg = w.validAngleDeg + WIDE_LOCK_CONE_ADD_RAD / DEG;
  return {
    ...w,
    validAngleDeg,
    lockConeRad: validAngleDeg * DEG,
    rangeM: w.rangeM * WIDE_LOCK_RANGE_MUL,
  };
}

const _wideIds: string[] = [];
const _wideD: number[] = [];

/**
 * Wide Lock Mode targets: the locked Target first, then the nearest other enemy Ships inside the cone and range.
 * Fills `_wideIds` (at most WIDE_LOCK_TARGETS).
 */
function wideLockTargets(ctx: SimCtx, rec: ShipRec, sec: WeaponDef): void {
  const s = rec.state;
  _wideIds.length = 0;
  _wideD.length = 0;
  if (s.lockTarget && lockable(ctx, s.lockTarget)) {
    _wideIds.push(s.lockTarget);
    _wideD.push(-1);
  }
  forwardOf(s.rot, _f);
  const cosCone = Math.cos(sec.validAngleDeg * DEG * rec.mods.lockConeMul);
  const range = advRadar(rec);
  for (const o of ctx.recList) {
    const os = o.state;
    if (os.nation === s.nation || os.id === s.lockTarget || !lockable(ctx, os.id)) continue;
    const dx = os.pos[0] - s.pos[0],
      dy = os.pos[1] - s.pos[1],
      dz = os.pos[2] - s.pos[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1 || d > range || (dx * _f[0]! + dy * _f[1]! + dz * _f[2]!) / d < cosCone) continue;
    // Insert sorted by distance, keep the nearest few.
    let k = _wideIds.length;
    while (k > 0 && _wideD[k - 1]! > d) k--;
    if (k >= WIDE_LOCK_TARGETS) continue;
    _wideIds.splice(k, 0, os.id);
    _wideD.splice(k, 0, d);
    if (_wideIds.length > WIDE_LOCK_TARGETS) {
      _wideIds.length = WIDE_LOCK_TARGETS;
      _wideD.length = WIDE_LOCK_TARGETS;
    }
  }
}

/** STD radar (m): Siege stretches it. */
function stdRadar(rec: ShipRec): number {
  return rec.fd.radarStdM * (rec.state.sieged ? siegeMods(rec.state).rangeMul : 1);
}

/** ADV radar (m): Wide Lock Mode stretches it. */
function advRadar(rec: ShipRec): number {
  return (
    rec.fd.radarAdvM * (rec.state.toggles.bombing === 'wide-lock-mode' ? WIDE_LOCK_RANGE_MUL : 1)
  );
}

/** Valid Angle (rad) of the Secondary with buffs, Siege and the server's lag tolerance. */
function validAngle(rec: ShipRec, sec: WeaponDef): number {
  const s = rec.state;
  return (
    (sec.validAngleDeg * rec.mods.lockConeMul * (s.sieged ? siegeLockConeMul(s) : 1) +
      TARGETING.lockToleranceDeg) *
    DEG
  );
}

// The selected Target this tick as the server accepts it (set by stepWeapons): id, aim point, distance, velocity.
let _tgt: { id: string; nation: NationId } | null = null;
let _tx = 0,
  _ty = 0,
  _tz = 0,
  _td = 0;
let _tv: readonly number[] = ZERO;

/**
 * The Pilot's selected Target if the server accepts it: a live hostile Ship (a cloaked one only inside the reveal
 * range) or a live hostile structure, inside the Frame's STD or ADV radar. Anything else counts as no Target.
 */
function selectTarget(ctx: SimCtx, rec: ShipRec, id: string | null): void {
  const s = rec.state;
  _tgt = null;
  if (!id) return;
  const sh = ctx.ships.get(id);
  let t: { id: string; nation: NationId };
  if (sh) {
    const o = sh.state;
    if (!o.alive || o.launchPhase !== 'none') return;
    _tx = o.pos[0];
    _ty = o.pos[1];
    _tz = o.pos[2];
    _tv = o.vel;
    t = o;
  } else {
    const st = structureById(ctx, id);
    if (!st || !st.state.alive) return;
    _tx = st.state.pos[0];
    _ty = st.state.pos[1] + st.height / 2;
    _tz = st.state.pos[2];
    _tv = ZERO;
    t = st.state;
  }
  if (t.nation === s.nation) return;
  _td = Math.hypot(_tx - s.pos[0], _ty - s.pos[1], _tz - s.pos[2]);
  if (_td < 1 || (sh?.mods.cloak && _td > CLOAK_REVEAL_M)) return;
  if (_td > Math.max(stdRadar(rec), advRadar(rec)) * (1 + TARGETING.rangeTolerance)) return;
  _tgt = t;
}

/** Cosine of the angle between the nose (`_f`, set by the caller) and the Target. */
function targetCos(s: ShipState): number {
  return ((_tx - s.pos[0]) * _f[0]! + (_ty - s.pos[1]) * _f[1]! + (_tz - s.pos[2]) * _f[2]!) / _td;
}

/**
 * Secondary lock: instant and purely conditional. LOCKED = the Target is inside ADV radar and within the weapon's
 * Valid Angle of the nose (cloaked Ships refuse locks). Lockless weapons (Valid Angle 0) never lock.
 */
function updateLock(ctx: SimCtx, rec: ShipRec, sec: WeaponDef): void {
  const s = rec.state;
  const ok =
    _tgt !== null &&
    sec.validAngleDeg > 0 &&
    !ctx.ships.get(_tgt.id)?.mods.cloak &&
    _td <= advRadar(rec) * (1 + TARGETING.rangeTolerance) &&
    targetCos(s) >= Math.cos(validAngle(rec, sec));
  s.canLock = ok;
  s.lockTarget = ok ? _tgt!.id : null;
  s.lockProgress = ok ? 1 : 0;
}

/**
 * Siege gun lock: the selected enemy Ship is acquired inside the aim-assist cone of the nose (on the tick Siege is
 * entered: anywhere in the break cone, the snap) and held while it stays inside the break cone, in STD radar and
 * in terrain line of sight. Dropping out means re-aiming to re-lock.
 */
function updateSiegeLock(ctx: SimCtx, rec: ShipRec, entering: boolean): void {
  const s = rec.state;
  const id = s.sieged && _tgt && ctx.ships.has(_tgt.id) ? _tgt.id : null;
  let keep = false;
  if (id && !ctx.ships.get(id)!.mods.cloak) {
    const dx = _tx - s.pos[0],
      dy = _ty - s.pos[1],
      dz = _tz - s.pos[2];
    const cone = s.siegeLock === id || entering ? SIEGE_GUN_BREAK_CONE_RAD : AIM_ASSIST.coneRad;
    // Ground Siege: the hull stays level and the gun elevates, so only the heading counts.
    const cos = s.grounded
      ? (dx * _f[0]! + dz * _f[2]!) / (Math.hypot(dx, dz) * Math.hypot(_f[0]!, _f[2]!) || 1)
      : targetCos(s);
    if (_td <= stdRadar(rec) * (1 + TARGETING.rangeTolerance) && cos >= Math.cos(cone)) {
      const ray = ctx.ray;
      ray.origin.x = s.pos[0];
      ray.origin.y = s.pos[1];
      ray.origin.z = s.pos[2];
      ray.dir.x = dx / _td;
      ray.dir.y = dy / _td;
      ray.dir.z = dz / _td;
      keep = ctx.world.castRay(ray, _td, true, undefined, RAY_QUERY_GROUPS) === null;
    }
  }
  s.siegeLock = keep ? id : null;
}

/** Time for a projectile of `speed` fired from the origin to meet a target moving at (vx,vy,vz). */
export function interceptTime(
  rx: number,
  ry: number,
  rz: number,
  vx: number,
  vy: number,
  vz: number,
  speed: number,
): number {
  const c = rx * rx + ry * ry + rz * rz;
  const direct = Math.sqrt(c) / speed;
  const a = vx * vx + vy * vy + vz * vz - speed * speed;
  const b = 2 * (rx * vx + ry * vy + rz * vz);
  let t = direct;
  if (Math.abs(a) < 1e-6) {
    if (b < 0) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a);
      const t2 = (-b + sq) / (2 * a);
      const lo = Math.min(t1, t2);
      const hi = Math.max(t1, t2);
      t = lo > 0 ? lo : hi > 0 ? hi : direct;
    }
  }
  return t;
}

// Lead point (relative to the muzzle) of the last `leadAt` call, and its length.
let _lx = 0,
  _ly = 0,
  _lz = 0,
  _ll = 0;

/** Lead point of a target at (tx,ty,tz) moving at `v`, for a round of `speed` fired from (ox,oy,oz). */
function leadAt(
  tx: number,
  ty: number,
  tz: number,
  v: readonly number[],
  ox: number,
  oy: number,
  oz: number,
  speed: number,
  maxSec: number,
): void {
  const rx = tx - ox,
    ry = ty - oy,
    rz = tz - oz;
  const tt = Math.min(interceptTime(rx, ry, rz, v[0]!, v[1]!, v[2]!, speed), maxSec);
  _lx = rx + v[0]! * tt;
  _ly = ry + v[1]! * tt;
  _lz = rz + v[2]! * tt;
  _ll = Math.hypot(_lx, _ly, _lz) || 1;
}

// Direction register written by `jitter`.
let _dx = 0,
  _dy = 0,
  _dz = 0;

/** Unit (bx,by,bz) pushed off by a random offset of radius `min + span * sqrt(rng)` (uses `_r`/`_u`). */
function jitter(ctx: SimCtx, bx: number, by: number, bz: number, min: number, span: number): void {
  const ang = ctx.rng() * Math.PI * 2;
  const rad = min + span * Math.sqrt(ctx.rng());
  const sx = Math.cos(ang) * rad,
    sy = Math.sin(ang) * rad;
  _dx = bx + _r[0]! * sx + _u[0]! * sy;
  _dy = by + _r[1]! * sx + _u[1]! * sy;
  _dz = bz + _r[2]! * sx + _u[2]! * sy;
  const l = Math.hypot(_dx, _dy, _dz);
  _dx /= l;
  _dy /= l;
  _dz /= l;
}

/** Lock, Siege gun lock, and Primary/Secondary fire for one Ship. Server only. */
export function stepWeapons(ctx: SimCtx, rec: ShipRec, input: PilotInput): void {
  const s = rec.state;
  const fd = rec.fd;
  const weapons = rec.gear ? rec.gear.weapons : [WEAPONS[fd.primary]!, WEAPONS[fd.secondary]!];
  const sec = bombingSecondary(weapons[1]!, s.toggles.bombing);
  const entering = s.sieged && !rec.wasSieged;
  rec.wasSieged = s.sieged;
  rec.siegeArm = entering ? SIEGE.armSec : Math.max(rec.siegeArm - ctx.dt, 0);
  forwardOf(s.rot, _f);
  rightOf(s.rot, _r);
  upOf(s.rot, _u);
  selectTarget(ctx, rec, input.target);
  updateLock(ctx, rec, sec);
  updateSiegeLock(ctx, rec, entering);
  const cold = s.halted || rec.mods.noAttack;
  stepPrimary(ctx, rec, weapons[0]!, !cold && input.fire1);
  const rewind = Math.min(Math.max(ctx.tick - input.viewTick, 0), MAX_REWIND_TICKS);
  stepSecondary(ctx, rec, sec, !cold && input.fire2, cold, rewind);
}

function dropCloak(rec: ShipRec): void {
  if (!rec.mods.cloak) return;
  breakCloak(rec.state);
  rec.mods.cloak = false;
}

/**
 * Primary (STD): fires whenever reattack, heat and ammo allow; each round of the pattern is an accuracy roll
 * against the selected Target. No Target (or out of STD radar, behind the nose, inside the Ground Siege minimum
 * range, below an Air Siege) = visual tracers only. A Siege gun lock always hits. Winning rounds deal their damage
 * when the tracer reaches the Target (see stepProjectiles).
 */
function stepPrimary(ctx: SimCtx, rec: ShipRec, w: WeaponDef, fire: boolean): void {
  const s = rec.state;
  rec.fireCd[0] = Math.max(rec.fireCd[0] - ctx.dt, -ctx.dt);
  if (s.overheated || !fire) {
    // Heat bleeds off in coolMul x overheatSec; the forced cool-down when overheated is OVERHEAT_COOL_MUL slower,
    // so bursting under the limit out-damages holding the trigger into it.
    const cool = TARGETING.coolMul * w.overheatSec * (s.overheated ? OVERHEAT_COOL_MUL : 1);
    s.heat = w.overheatSec > 0 ? Math.max(s.heat - ctx.dt / cool, 0) : 0;
    if (s.heat === 0) s.overheated = false;
  }
  if (!fire || s.overheated || rec.fireCd[0] > 0 || s.ammo1 <= 0) return;
  if (s.sieged && rec.siegeArm > 0) return;
  const interval = w.fireIntervalSec / rec.mods.fireRateMul;
  rec.fireCd[0] += interval;
  if (w.overheatSec > 0) {
    s.heat = Math.min(s.heat + interval / w.overheatSec, 1);
    if (s.heat >= 1) s.overheated = true;
  }
  dropCloak(rec);
  // An armed Primary shot (consumed by this pattern's first round).
  const shotMul = rec.mods.primaryShotMul;
  const charged = shotMul !== 1;
  if (charged) {
    dropBuffs(s, (e) => e.primaryShotMul !== undefined);
    rec.mods.primaryShotMul = 1;
  }
  const mods = s.sieged ? siegeMods(s) : null;
  const range = w.rangeM * (mods ? mods.rangeMul : 1);
  const damage =
    w.damage * rec.mods.damageMul * rec.mods.primaryDamageMul * (mods ? mods.damageMul : 1);
  // Hit chance this pattern; 0 = no damage, visual only.
  let chance = 0;
  const gunLock = _tgt !== null && s.siegeLock === _tgt.id;
  if (_tgt && _td <= stdRadar(rec) * (1 + TARGETING.rangeTolerance)) {
    const falloffRange = range * (charged ? CHARGED_SHOT_RANGE_MUL : 1);
    if (gunLock) chance = 1;
    else if (targetCos(s) >= Math.cos(TARGETING.stdConeRad))
      chance =
        (w.accuracy + rec.mods.accuracyAdd) *
        (_td > falloffRange ? TARGETING.falloffBase ** ((_td / falloffRange - 1) * 100) : 1);
    if (s.sieged && s.grounded && _td < SIEGE.minRangeM) chance = 0;
    if (s.sieged && !s.grounded && (_ty - s.pos[1]) / _td < -Math.sin(SIEGE_AIR.maxDepressionRad))
      chance = 0;
  }
  const nose = rec.fd.halfLength + NOSE_OFFSET;
  const ox = s.pos[0] + _f[0]! * nose,
    oy = s.pos[1] + _f[1]! * nose,
    oz = s.pos[2] + _f[2]! * nose;
  if (chance > 0) leadAt(_tx, _ty, _tz, _tv, ox, oy, oz, w.speed, range / w.speed);
  const n = Math.min(w.pattern.count, s.ammo1);
  s.ammo1 -= n;
  const spread = w.spread * rec.mods.spreadMul;
  for (let k = 0; k < n; k++) {
    const hit = chance > 0 && ctx.rng() < chance;
    if (chance <= 0) jitter(ctx, _f[0]!, _f[1]!, _f[2]!, 0, spread);
    else if (hit) jitter(ctx, _lx / _ll, _ly / _ll, _lz / _ll, 0, spread * AIM_ASSIST.spreadMul);
    else jitter(ctx, _lx / _ll, _ly / _ll, _lz / _ll, TARGETING.missSpreadRad, spread);
    const roll = 1 + (ctx.rng() * 2 - 1) * TARGETING.damageSpread;
    const p = spawnProjectile(
      ctx,
      rec,
      w.kind,
      w.id,
      damage * roll * (charged && k === 0 ? shotMul : 1),
      w.splashRadius * rec.mods.splashMul,
      w.speed,
      hit ? Math.max(range, _ll + 1) : range,
      0,
      hit ? _tgt!.id : null,
      ox,
      oy,
      oz,
      _dx,
      _dy,
      _dz,
      0,
    );
    p.visual = !hit;
    if (hit) {
      p.strike = _tgt!.id;
      p.strikeAt = _ll;
    }
  }
}

/** Seconds of reattack for the Secondary (counted from the end of the salvo). */
function secondaryInterval(rec: ShipRec, w: WeaponDef): number {
  return w.fireIntervalSec / rec.mods.secondaryFireRateMul;
}

/**
 * Secondary (ADV), a count x series pattern; reattack counts from the end of the salvo. Fired while LOCKED
 * (same tick the lock comes in), missiles home at the salvo's Target and the Bulwark salvo flies straight at
 * its lead point, needing the lock held for every volley. Without a lock the salvo dumb-fires straight off the
 * nose (contact or splash only). Anvil bombs and its bombing modes never lock.
 */
function stepSecondary(
  ctx: SimCtx,
  rec: ShipRec,
  w: WeaponDef,
  fire: boolean,
  cold: boolean,
  rewind: number,
): void {
  const s = rec.state;
  const interval = secondaryInterval(rec, w);
  if (rec.salvoLeft <= 0) {
    rec.fireCd[1] = Math.max(rec.fireCd[1] - ctx.dt, -ctx.dt);
    if (fire && rec.fireCd[1] <= 0 && s.ammo2 > 0) {
      const mode = s.toggles.bombing;
      if (mode || w.validAngleDeg <= 0) {
        rec.fireCd[1] += interval * (mode ? BOMBING_REATTACK_MUL : 1);
        dropCloak(rec);
        fireLockless(ctx, rec, w, mode, rewind);
      } else {
        // LOCKED: guided at the Target. No lock: the same salvo dumb-fires straight off the nose.
        rec.salvoLeft = w.pattern.series + (w.kind === 'missile' ? rec.mods.salvoAdd : 0);
        rec.salvoCd = 0;
        rec.salvoTarget = s.lockTarget;
        dropCloak(rec);
      }
    }
  }
  if (rec.salvoLeft > 0) {
    if (cold || s.ammo2 <= 0) rec.salvoLeft = 0;
    else {
      rec.salvoCd -= ctx.dt;
      if (rec.salvoCd <= 0) {
        volley(ctx, rec, w, rewind);
        rec.salvoCd += TARGETING.seriesSec;
        rec.salvoLeft--;
      }
    }
    if (rec.salvoLeft <= 0) {
      rec.salvoTarget = null;
      rec.fireCd[1] = interval;
    }
  }
  s.advReadyIn =
    rec.salvoLeft > 0
      ? Math.max(rec.salvoCd, 0) + (rec.salvoLeft - 1) * TARGETING.seriesSec + interval
      : Math.max(rec.fireCd[1], 0);
}

const _ids: number[] = [];

/** One volley of a locked salvo (see stepSecondary). */
function volley(ctx: SimCtx, rec: ShipRec, w: WeaponDef, rewind: number): void {
  const s = rec.state;
  const mods = s.sieged ? siegeMods(s) : null;
  const nose = rec.fd.halfLength + NOSE_OFFSET;
  const ox = s.pos[0] + _f[0]! * nose,
    oy = s.pos[1] + _f[1]! * nose,
    oz = s.pos[2] + _f[2]! * nose;
  const target = rec.salvoTarget;
  const missile = w.kind === 'missile';
  // Straight shells aim at the lead point, only while the lock holds.
  const aimed = !missile && target !== null && s.lockTarget === target && lockable(ctx, target);
  if (aimed) {
    leadAt(
      _tp[0]!,
      _tp[1]!,
      _tp[2]!,
      ctx.ships.get(target)?.state.vel ?? ZERO,
      ox,
      oy,
      oz,
      w.speed,
      w.rangeM / w.speed,
    );
    _lx /= _ll;
    _ly /= _ll;
    _lz /= _ll;
  }
  const count = Math.min(w.pattern.count, s.ammo2);
  s.ammo2 -= count;
  _ids.length = 0;
  for (let k = 0; k < count; k++) {
    const fan = (k - (count - 1) / 2) * MISSILE_SALVO_SPREAD_RAD;
    const bx = aimed ? _lx : _f[0]!,
      by = aimed ? _ly : _f[1]!,
      bz = aimed ? _lz : _f[2]!;
    jitter(
      ctx,
      bx + _r[0]! * fan,
      by + _r[1]! * fan,
      bz + _r[2]! * fan,
      0,
      w.spread * rec.mods.spreadMul,
    );
    const p = spawnProjectile(
      ctx,
      rec,
      w.kind,
      w.id,
      w.damage * rec.mods.damageMul * rec.mods.secondaryDamageMul * (mods ? mods.damageMul : 1),
      w.splashRadius * rec.mods.splashMul,
      w.speed,
      w.rangeM * (mods ? mods.rangeMul : 1),
      missile ? w.homingTurnRate : 0,
      missile || aimed ? target : null,
      ox,
      oy,
      oz,
      _dx,
      _dy,
      _dz,
      // Dumb rounds hit-test where the shooter saw the world (lag compensation).
      (missile && target) || aimed ? 0 : rewind,
    );
    _ids.push(p.id);
  }
  if (target && (missile || aimed)) warn(ctx, s.id, target, w.id, _ids);
}

/** missileIncoming for a volley fired at a Ship; its projectiles will report missileEnded. */
function warn(ctx: SimCtx, attacker: ShipId, target: string, weapon: string, ids: number[]): void {
  if (!ctx.ships.has(target) || ids.length === 0) return;
  for (const p of ctx.projectiles) if (ids.includes(p.id)) p.warned = true;
  ctx.events.push({ type: 'missileIncoming', attacker, target, weapon, missiles: ids.slice() });
}

/** Old per-round share of the Secondary's damage vs Base structures, before the one-hit-kill bombing tune. */
const BOMBING_STRUCTURE_SHARE = 0.4;

/**
 * Bombing-mode round: full damage anywhere inside its proximity-fuse radius (so a near miss still one-hits), and
 * structures take only BOMBING_STRUCTURE_SHARE of the Secondary's damage, as before the tune.
 */
function bombingRound(p: Projectile, damageMul: number): void {
  p.core = p.splash * ROCKET_FUSE_FRAC;
  p.structMul = BOMBING_STRUCTURE_SHARE / damageMul;
}

/** Anvil Secondary: bombs and bombing modes, no lock needed (Wide Lock guides at whatever it has). */
function fireLockless(
  ctx: SimCtx,
  rec: ShipRec,
  w: WeaponDef,
  mode: string | undefined,
  rewind: number,
): void {
  const s = rec.state;
  const fd = rec.fd;
  s.ammo2--;
  const slotMul = rec.mods.secondaryDamageMul;
  const mods = s.sieged ? siegeMods(s) : null;
  const nose = fd.halfLength + NOSE_OFFSET;
  const ox = s.pos[0] + _f[0]! * nose,
    oy = s.pos[1] + _f[1]! * nose,
    oz = s.pos[2] + _f[2]! * nose;
  if (mode === 'air-barrage-mode') {
    // Forward salvo: the first rocket's ammo is already paid; each extra rocket costs 1.
    const extra = Math.min(AIR_BARRAGE_COUNT - 1, s.ammo2);
    s.ammo2 -= extra;
    const count = 1 + extra;
    for (let k = 0; k < count; k++) {
      const off = (k - (count - 1) / 2) * AIR_BARRAGE_SPREAD_RAD;
      const adx = _f[0]! + _r[0]! * off,
        ady = _f[1]! + _r[1]! * off,
        adz = _f[2]! + _r[2]! * off;
      const al = Math.hypot(adx, ady, adz);
      const p = spawnProjectile(
        ctx,
        rec,
        w.kind,
        w.id,
        w.damage *
          AIR_BARRAGE_DAMAGE_MUL *
          rec.mods.damageMul *
          slotMul *
          (mods ? mods.damageMul : 1),
        w.splashRadius * AIR_BARRAGE_SPLASH_MUL * rec.mods.splashMul,
        w.speed,
        w.rangeM * AIR_BARRAGE_RANGE_MUL * (mods ? mods.rangeMul : 1),
        0,
        null,
        ox,
        oy,
        oz,
        adx / al,
        ady / al,
        adz / al,
        rewind,
      );
      bombingRound(p, AIR_BARRAGE_DAMAGE_MUL);
    }
    return;
  }
  if (mode === 'wide-lock-mode') {
    // One guided rocket per target (locked Target first, then the nearest in the cone): the first is already
    // paid, each extra costs 1. No target: a single rocket flies straight off the nose.
    wideLockTargets(ctx, rec, w);
    const count = Math.max(1, Math.min(_wideIds.length, 1 + s.ammo2));
    s.ammo2 -= count - 1;
    for (let k = 0; k < count; k++) {
      const target = _wideIds[k] ?? null;
      const off = (k - (count - 1) / 2) * AIR_BARRAGE_SPREAD_RAD;
      const adx = _f[0]! + _r[0]! * off,
        ady = _f[1]! + _r[1]! * off,
        adz = _f[2]! + _r[2]! * off;
      const al = Math.hypot(adx, ady, adz);
      const p = spawnProjectile(
        ctx,
        rec,
        target ? 'missile' : w.kind,
        w.id,
        w.damage *
          WIDE_LOCK_DAMAGE_MUL *
          rec.mods.damageMul *
          slotMul *
          (mods ? mods.damageMul : 1),
        w.splashRadius * rec.mods.splashMul,
        w.speed,
        w.rangeM * (mods ? mods.rangeMul : 1),
        target ? WIDE_LOCK_HOMING_TURN : 0,
        target,
        ox,
        oy,
        oz,
        adx / al,
        ady / al,
        adz / al,
        rewind,
      );
      bombingRound(p, WIDE_LOCK_DAMAGE_MUL);
      if (target) {
        _ids.length = 0;
        _ids.push(p.id);
        warn(ctx, s.id, target, w.id, _ids);
      }
    }
    return;
  }
  if (mode === 'ground-strike-mode') {
    // A stick of heavy bombs thrown forward (the Ship's velocity plus a level forward kick), fanned sideways,
    // then falling under gravity. The first bomb's ammo is already paid; each extra one costs 1.
    const extra = Math.min(GROUND_STRIKE_COUNT - 1, s.ammo2);
    s.ammo2 -= extra;
    const kick = BOMB_FORWARD_KICK / (Math.hypot(_f[0]!, _f[2]!) || 1);
    for (let k = 0; k <= extra; k++) {
      const side = extra > 0 ? ((2 * k) / extra - 1) * GROUND_STRIKE_SPREAD_MPS : 0;
      const bvx = s.vel[0] + _f[0]! * kick + _r[0]! * side,
        bvy = s.vel[1] - BOMB_DROP_SPEED,
        bvz = s.vel[2] + _f[2]! * kick + _r[2]! * side;
      const bs = Math.hypot(bvx, bvy, bvz) || 1;
      const bomb = spawnProjectile(
        ctx,
        rec,
        w.kind,
        w.id,
        w.damage *
          GROUND_STRIKE_DAMAGE_MUL *
          rec.mods.damageMul *
          slotMul *
          (mods ? mods.damageMul : 1),
        w.splashRadius * GROUND_STRIKE_SPLASH_MUL * rec.mods.splashMul,
        bs,
        w.rangeM * BOMB_RANGE_MUL,
        0,
        null,
        s.pos[0],
        s.pos[1] - fd.radius - 1,
        s.pos[2],
        bvx / bs,
        bvy / bs,
        bvz / bs,
        rewind,
      );
      bomb.gravity = BOMB_GRAVITY;
      bomb.groundMul = GROUND_STRIKE_GROUND_MUL;
      bombingRound(bomb, GROUND_STRIKE_DAMAGE_MUL);
    }
    return;
  }
  // Plain bomb: straight off the nose with a little spread.
  jitter(ctx, _f[0]!, _f[1]!, _f[2]!, 0, w.spread * rec.mods.spreadMul);
  spawnProjectile(
    ctx,
    rec,
    w.kind,
    w.id,
    w.damage * rec.mods.damageMul * slotMul * (mods ? mods.damageMul : 1),
    w.splashRadius * rec.mods.splashMul,
    w.speed,
    w.rangeM * (mods ? mods.rangeMul : 1),
    0,
    null,
    ox,
    oy,
    oz,
    _dx,
    _dy,
    _dz,
    rewind,
  );
}

function recycle(ctx: SimCtx, index: number, reason: 'hit' | 'impact' | 'expired'): void {
  const list = ctx.projectiles;
  const p = list[index]!;
  if (p.warned) ctx.events.push({ type: 'missileEnded', id: p.id, reason });
  const last = list.pop()!;
  if (last !== p) list[index] = last;
  ctx.pool.push(p);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Deterministic hash of a projectile id to [0,1). */
function hash01(id: number, k: number): number {
  return ((Math.imul(id, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0) / 4294967296;
}

/**
 * Corkscrew offset around the flight line: a circle of radius `amp` in the plane perpendicular to the
 * heading. Only the change in offset is applied each tick, so the path is the line plus the circle.
 */
function applyWeave(p: Projectile, age: number, amp: number, period: number, dt: number): void {
  let e1x = -p.dz,
    e1z = p.dx;
  let l = Math.hypot(e1x, e1z);
  if (l < 1e-4) {
    e1x = 1;
    e1z = 0;
    l = 1;
  }
  e1x /= l;
  e1z /= l;
  // e2 = d x e1
  const e2x = p.dy * e1z,
    e2y = p.dz * e1x - p.dx * e1z,
    e2z = -p.dy * e1x;
  const phi = hash01(p.id, 3) * Math.PI * 2;
  const th = phi + (Math.PI * 2 * age * dt) / period;
  const thPrev = phi + (Math.PI * 2 * (age - 1) * dt) / period;
  const c = Math.cos(th) * amp - Math.cos(thPrev) * p.weaveAmp;
  const s = Math.sin(th) * amp - Math.sin(thPrev) * p.weaveAmp;
  p.x += e1x * c + e2x * s;
  p.y += e2y * s;
  p.z += e1z * c + e2z * s;
  p.weaveAmp = amp;
}

/** Ground-strike bonus applies to Grounded or Docked victims. */
function victimMul(p: Projectile, victim: ShipRec): number {
  return victim.state.grounded || victim.state.docked ? p.groundMul : 1;
}

function explode(
  ctx: SimCtx,
  p: Projectile,
  x: number,
  y: number,
  z: number,
  direct: ShipRec | null,
  structure: StructureRec | null,
): void {
  if (direct) hitShip(ctx, direct, p.damage * victimMul(p, direct), p.owner, p, x, y, z);
  if (structure && structure.state.nation !== p.nation)
    damageStructure(ctx, structure, structureDamage(p), p.owner, p.id, x, y, z);
  if (p.splash <= 0) return;
  splashStructures(
    ctx,
    p.nation,
    structureDamage(p),
    p.splash,
    SPLASH_MIN_FRACTION,
    structure,
    p.owner,
    p.id,
    x,
    y,
    z,
  );
  // Splash sees Ships where the hit test did: in the shooter's past for unguided rounds (lag compensation).
  const testTick = p.homing > 0 && p.target ? ctx.tick : ctx.tick - p.rewind;
  for (const o of ctx.recList) {
    const os = o.state;
    if (o === direct || !os.alive || os.nation === p.nation || os.launchPhase !== 'none') continue;
    poseAt(ctx, o, testTick);
    const d = Math.hypot(_cx - x, _cy - y, _cz - z) - ctx.frames[os.frame].radius;
    if (d >= p.splash) continue;
    const fall =
      d <= p.core ? 1 : Math.max(1 - (d - p.core) / (p.splash - p.core), SPLASH_MIN_FRACTION);
    hitShip(ctx, o, p.damage * fall * victimMul(p, o), p.owner, p, x, y, z);
  }
}

/** Advance all Projectiles one tick: homing, swept terrain/wall/Ship tests, expiry. */
export function stepProjectiles(ctx: SimCtx): void {
  const dt = ctx.dt;
  const ray = ctx.ray;
  for (const r of ctx.recList) {
    r.state.incomingDist = -1;
    r.state.incomingTti = -1;
  }
  for (let i = ctx.projectiles.length - 1; i >= 0; i--) {
    const p = ctx.projectiles[i]!;
    const age = ctx.tick - p.spawnTick;

    let weaveAmp = -1; // < 0: no weave this tick
    let weavePeriod = 1;
    if (p.kind === 'rocket' && p.gravity === 0) {
      weaveAmp = ROCKET_WOBBLE_AMP_M;
      weavePeriod = ROCKET_WOBBLE_PERIOD_SEC;
    }
    if (p.gravity > 0) {
      // Bombs fall: add gravity to the velocity vector.
      const gvy = p.dy * p.speed - p.gravity * dt;
      const gvx = p.dx * p.speed,
        gvz = p.dz * p.speed;
      p.speed = Math.hypot(gvx, gvy, gvz) || 1;
      p.dx = gvx / p.speed;
      p.dy = gvy / p.speed;
      p.dz = gvz / p.speed;
    }
    const homeSt =
      p.homing > 0 && p.target && !ctx.ships.has(p.target)
        ? structureById(ctx, p.target)
        : undefined;
    if (homeSt) {
      // Structures don't dodge: steer straight at mid-height; the collider ray below does the hit.
      if (!homeSt.state.alive) p.target = null;
      else {
        let sx = homeSt.state.pos[0] - p.x,
          sy = homeSt.state.pos[1] + homeSt.height / 2 - p.y,
          sz = homeSt.state.pos[2] - p.z;
        const sl = Math.hypot(sx, sy, sz) || 1;
        sx /= sl;
        sy /= sl;
        sz /= sl;
        const angle = Math.acos(Math.min(Math.max(p.dx * sx + p.dy * sy + p.dz * sz, -1), 1));
        const frac = angle <= p.homing * dt ? 1 : (p.homing * dt) / angle;
        const nx = p.dx + (sx - p.dx) * frac,
          ny = p.dy + (sy - p.dy) * frac,
          nz = p.dz + (sz - p.dz) * frac;
        const nl = Math.hypot(nx, ny, nz) || 1;
        p.dx = nx / nl;
        p.dy = ny / nl;
        p.dz = nz / nl;
      }
    } else if (p.homing > 0 && p.target) {
      const t = ctx.ships.get(p.target);
      if (!t || !t.state.alive) {
        p.target = null;
      } else {
        const ts = t.state;
        let tx = ts.pos[0] - p.x,
          ty = ts.pos[1] - p.y,
          tz = ts.pos[2] - p.z;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl;
        ty /= tl;
        tz /= tl;
        const missile = p.kind === 'missile';
        let broke: 'roll' | 'terrain' | 'lost' | null = null;
        if (missile) {
          if (ts.rollTicks > 0 && tl < MISSILE_EVADE.rollBreakDistM && !t.mods.missileBlind) {
            broke = 'roll';
          } else if (
            age * dt > MISSILE_MOTOR_SEC ||
            (tl < MISSILE_EVADE.endgameDistM &&
              (p.dx * tx + p.dy * ty + p.dz * tz < Math.cos(SEEKER_CONE_RAD) ||
                ts.speed * Math.hypot(ts.angVel[0], ts.angVel[1], ts.angVel[2]) >=
                  BREAK_TURN_ACCEL))
          ) {
            // Motor burnt out, the target slipped out of the seeker cone, or it out-turns the missile up close.
            broke = 'lost';
          } else {
            // Terrain line of sight to the target.
            ray.origin.x = p.x;
            ray.origin.y = p.y;
            ray.origin.z = p.z;
            ray.dir.x = tx;
            ray.dir.y = ty;
            ray.dir.z = tz;
            const blocked = ctx.world.castRay(ray, tl, true, undefined, RAY_QUERY_GROUPS) !== null;
            p.losTime = blocked ? p.losTime + dt : 0;
            if (p.losTime >= MISSILE_EVADE.losBreakSec) broke = 'terrain';
          }
        }
        if (broke) {
          p.target = null;
          p.homing = 0;
          if (missile)
            ctx.events.push({ type: 'missileEvaded', id: p.id, victim: ts.id, reason: broke });
        } else {
          const turn =
            p.homing *
            (missile && tl < MISSILE_EVADE.endgameDistM ? MISSILE_EVADE.endgameTurnMul : 1);
          // Missiles steer at the target's intercept point (lead pursuit), not at its current position.
          let sx = tx,
            sy = ty,
            sz = tz;
          if (missile) {
            const tt = Math.min(
              interceptTime(tx * tl, ty * tl, tz * tl, ts.vel[0], ts.vel[1], ts.vel[2], p.speed),
              NAV_MAX_LEAD_SEC,
            );
            sx = tx * tl + ts.vel[0] * tt;
            sy = ty * tl + ts.vel[1] * tt;
            sz = tz * tl + ts.vel[2] * tt;
            const sl = Math.hypot(sx, sy, sz) || 1;
            sx /= sl;
            sy /= sl;
            sz /= sl;
            // Corkscrew weave amplitude: ramps in after launch, fades out through the endgame.
            const ramp = Math.min((age * dt) / WEAVE_RAMP_SEC, 1);
            const fade = clamp01(
              (tl - MISSILE_EVADE.endgameDistM * 0.5) / (MISSILE_EVADE.endgameDistM * 0.5),
            );
            weaveAmp = (WEAVE_AMP_MIN_M + WEAVE_AMP_SPAN_M * hash01(p.id, 2)) * ramp * fade;
            weavePeriod = WEAVE_PERIOD_MIN_SEC + WEAVE_PERIOD_SPAN_SEC * hash01(p.id, 1);
          }
          const cosA = Math.min(Math.max(p.dx * sx + p.dy * sy + p.dz * sz, -1), 1);
          const angle = Math.acos(cosA);
          const maxTurn = turn * dt;
          const frac = angle <= maxTurn ? 1 : maxTurn / angle;
          let nx = p.dx + (sx - p.dx) * frac,
            ny = p.dy + (sy - p.dy) * frac,
            nz = p.dz + (sz - p.dz) * frac;
          const nl = Math.hypot(nx, ny, nz) || 1;
          p.dx = nx / nl;
          p.dy = ny / nl;
          p.dz = nz / nl;
          // Proximity fuse: still tracking and inside the fuse radius = detonate on the target (not while rolling).
          if (missile && ts.rollTicks === 0 && tl <= ctx.frames[ts.frame].radius + MISSILE_FUSE_M) {
            explode(ctx, p, p.x, p.y, p.z, t, null);
            ctx.events.push({ type: 'projectileExpired', id: p.id, pos: [p.x, p.y, p.z] });
            recycle(ctx, i, 'hit');
            continue;
          }
          if (missile && !t.mods.missileBlind && (ts.incomingDist < 0 || tl < ts.incomingDist)) {
            ts.incomingDist = tl;
            ts.incomingTti = tl / p.speed;
          }
        }
      }
    }

    const step = Math.min(p.speed * dt, Math.max(p.range - p.travelled, 0));
    const x1 = p.x + p.dx * step,
      y1 = p.y + p.dy * step,
      z1 = p.z + p.dz * step;
    let hitT = Infinity; // distance along the step
    let victim: ShipRec | null = null;
    let structure: StructureRec | null = null;
    let dome: StructureRec | null = null;
    let fused = false;

    // Visual and rolled Primary rounds touch nothing but terrain (and their Target, below).
    const physical = !p.visual && p.strike === null;
    if (step > 0) {
      ray.origin.x = p.x;
      ray.origin.y = p.y;
      ray.origin.z = p.z;
      ray.dir.x = p.dx;
      ray.dir.y = p.dy;
      ray.dir.z = p.dz;
      const hit = ctx.world.castRay(ray, step, true, undefined, RAY_QUERY_GROUPS);
      if (hit) {
        hitT = hit.timeOfImpact;
        structure = ctx.structureByCollider.get(hit.collider.handle) ?? null;
      }

      // Favor the shooter for the whole flight: Ships where the shooter saw them, `rewind` ticks back.
      // Homing shots follow the live target (and everyone sees them from snapshots): no rewind.
      const testTick = p.homing > 0 && p.target ? ctx.tick : ctx.tick - p.rewind;
      for (const o of physical ? ctx.recList : NO_SHIPS) {
        const os = o.state;
        if (!os.alive || os.nation === p.nation || os.rollTicks > 0 || os.launchPhase !== 'none')
          continue;
        const fd = ctx.frames[os.frame];
        poseAt(ctx, o, testTick);
        const fuse = p.kind === 'rocket' ? p.splash * ROCKET_FUSE_FRAC : 0;
        const reach = fd.halfLength + PROJECTILE_RADIUS + step + fuse;
        if (
          Math.abs(_cx - p.x) > reach ||
          Math.abs(_cy - p.y) > reach ||
          Math.abs(_cz - p.z) > reach
        )
          continue;
        // Rockets and bombs carry a proximity fuse: they burst when a hull comes within part of their blast.
        const contact = fd.radius + PROJECTILE_RADIUS;
        const r = contact + fuse;
        const d2 = segmentCapsuleDist2(
          p.x,
          p.y,
          p.z,
          x1,
          y1,
          z1,
          Math.max(fd.halfLength - fd.radius, 0),
        );
        if (d2 <= r * r && _s * step < hitT) {
          hitT = _s * step;
          // A proximity burst (no contact) deals splash damage with falloff, not a direct hit.
          victim = d2 <= contact * contact ? o : null;
          fused = true;
        }
      }
      if (fused) structure = null;
      const domeT = physical
        ? domeEntry(ctx, p.nation, p.x, p.y, p.z, p.dx, p.dy, p.dz, step)
        : Infinity;
      if (domeT < hitT) {
        hitT = domeT;
        victim = structure = null;
        dome = domeHitCore();
      }
    }

    // A rolled hit lands on its Target once the tracer gets there, unless terrain is in the way first.
    const strikeT = p.strike !== null ? Math.max(p.strikeAt - p.travelled, 0) : Infinity;
    if (strikeT <= step && strikeT < hitT) {
      const sh = ctx.ships.get(p.strike!);
      const st = sh ? undefined : structureById(ctx, p.strike!);
      const hx = p.x + p.dx * strikeT,
        hy = p.y + p.dy * strikeT,
        hz = p.z + p.dz * strikeT;
      if (sh) explode(ctx, p, sh.state.pos[0], sh.state.pos[1], sh.state.pos[2], sh, null);
      else if (st) explode(ctx, p, hx, hy, hz, null, st);
      ctx.events.push({ type: 'projectileExpired', id: p.id, pos: [hx, hy, hz] });
      recycle(ctx, i, 'hit');
      continue;
    }
    if (hitT !== Infinity) {
      const hx = p.x + p.dx * hitT,
        hy = p.y + p.dy * hitT,
        hz = p.z + p.dz * hitT;
      if (dome) damageStructure(ctx, dome, structureDamage(p), p.owner, p.id, hx, hy, hz);
      else if (physical) explode(ctx, p, hx, hy, hz, victim, structure);
      else if (structure && structure.state.id === p.strike)
        explode(ctx, p, hx, hy, hz, null, structure);
      ctx.events.push({ type: 'projectileExpired', id: p.id, pos: [hx, hy, hz] });
      recycle(ctx, i, fused ? 'hit' : 'impact');
      continue;
    }
    p.x = x1;
    p.y = y1;
    p.z = z1;
    if (weaveAmp >= 0) applyWeave(p, age, weaveAmp, weavePeriod, dt);
    else p.weaveAmp = 0;
    p.travelled += step;
    if (p.travelled >= p.range - 1e-6) {
      ctx.events.push({ type: 'projectileExpired', id: p.id, pos: [p.x, p.y, p.z] });
      recycle(ctx, i, 'expired');
    }
  }
}
