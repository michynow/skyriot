import { SIEGE } from '../content/frames';
import { WEAPONS } from '../content/weapons';
import {
  LAG_COMP_MAX_MS,
  TICK_HZ,
  type PilotInput,
  type ProjectileKind,
  type ShipId,
} from '../types';
import type { Projectile, ShipRec, SimCtx } from './ctx';
import {
  LAG_HISTORY_TICKS,
  LOCK_RETAIN_CONE_MUL,
  NOSE_OFFSET,
  PROJECTILE_RADIUS,
  RAY_QUERY_GROUPS,
  SPLASH_MIN_FRACTION,
  WALL_RADIUS,
} from './constants';
import { hitShip } from './damage';
import { forwardOf, rightOf, upOf } from './math';

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
  owner: ShipRec,
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
): void {
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
}

function acquireLock(
  ctx: SimCtx,
  rec: ShipRec,
  cone: number,
  range: number,
  lockSec: number,
): void {
  const s = rec.state;
  forwardOf(s.rot, _f);
  if (s.lockTarget) {
    const t = ctx.ships.get(s.lockTarget);
    if (t && t.state.alive && t.flareTicks === 0) {
      const dx = t.state.pos[0] - s.pos[0],
        dy = t.state.pos[1] - s.pos[1],
        dz = t.state.pos[2] - s.pos[2];
      const d = Math.hypot(dx, dy, dz) || 1;
      if (
        d <= range &&
        (dx * _f[0]! + dy * _f[1]! + dz * _f[2]!) / d >= Math.cos(cone * LOCK_RETAIN_CONE_MUL)
      )
        return;
    }
    s.lockTarget = null;
  }
  const minCos = Math.cos(cone);
  let best: ShipRec | null = null;
  let bestCos = minCos;
  for (const o of ctx.recList) {
    const os = o.state;
    if (!os.alive || os.nation === s.nation || o.flareTicks > 0) continue;
    const dx = os.pos[0] - s.pos[0],
      dy = os.pos[1] - s.pos[1],
      dz = os.pos[2] - s.pos[2];
    const d = Math.hypot(dx, dy, dz);
    if (d > range || d < 1) continue;
    const c = (dx * _f[0]! + dy * _f[1]! + dz * _f[2]!) / d;
    if (c > bestCos) {
      bestCos = c;
      best = o;
    }
  }
  if (!best) {
    rec.lockCand = null;
    rec.lockTime = 0;
    return;
  }
  if (best.state.id === rec.lockCand) rec.lockTime += ctx.dt;
  else {
    rec.lockCand = best.state.id;
    rec.lockTime = 0;
  }
  if (rec.lockTime >= lockSec) s.lockTarget = rec.lockCand;
}

/** Lock-on progress and Primary/Secondary fire for one Ship. */
export function stepWeapons(ctx: SimCtx, rec: ShipRec, input: PilotInput): void {
  const s = rec.state;
  const fd = ctx.frames[s.frame];
  const weapons = [WEAPONS[fd.primary]!, WEAPONS[fd.secondary]!];
  const sec = weapons[1]!;
  if (sec.lockConeRad > 0) acquireLock(ctx, rec, sec.lockConeRad, sec.rangeM, sec.lockTimeSec);
  const rewind = Math.min(Math.max(ctx.tick - input.viewTick, 0), MAX_REWIND_TICKS);
  const fire = [input.fire1, input.fire2];
  for (let i = 0; i < 2; i++) {
    rec.fireCd[i] = Math.max(rec.fireCd[i]! - ctx.dt, -ctx.dt);
    const w = weapons[i]!;
    if (!fire[i] || rec.fireCd[i]! > 0) continue;
    rec.fireCd[i] = rec.fireCd[i]! + w.fireIntervalSec;
    forwardOf(s.rot, _f);
    rightOf(s.rot, _r);
    upOf(s.rot, _u);
    const ang = ctx.rng() * Math.PI * 2;
    const rad = w.spread * Math.sqrt(ctx.rng());
    const sx = Math.cos(ang) * rad,
      sy = Math.sin(ang) * rad;
    let dx = _f[0]! + _r[0]! * sx + _u[0]! * sy;
    let dy = _f[1]! + _r[1]! * sx + _u[1]! * sy;
    let dz = _f[2]! + _r[2]! * sx + _u[2]! * sy;
    const dl = Math.hypot(dx, dy, dz);
    dx /= dl;
    dy /= dl;
    dz /= dl;
    const siege = s.sieged;
    const target = w.homingTurnRate > 0 ? s.lockTarget : null;
    const nose = fd.halfLength + NOSE_OFFSET;
    spawnProjectile(
      ctx,
      rec,
      w.kind,
      w.id,
      w.damage * (siege ? SIEGE.damageMul : 1),
      w.splashRadius,
      w.speed,
      w.rangeM * (siege ? SIEGE.rangeMul : 1),
      w.homingTurnRate,
      target,
      s.pos[0] + _f[0]! * nose,
      s.pos[1] + _f[1]! * nose,
      s.pos[2] + _f[2]! * nose,
      dx,
      dy,
      dz,
      rewind,
    );
    if (target) {
      s.lockTarget = null;
      rec.lockCand = null;
      rec.lockTime = 0;
    }
  }
}

function recycle(ctx: SimCtx, index: number): void {
  const list = ctx.projectiles;
  const p = list[index]!;
  const last = list.pop()!;
  if (last !== p) list[index] = last;
  ctx.pool.push(p);
}

function explode(
  ctx: SimCtx,
  p: Projectile,
  x: number,
  y: number,
  z: number,
  direct: ShipRec | null,
): void {
  if (direct) hitShip(ctx, direct, p.damage, p.owner, p.id, x, y, z);
  if (p.splash <= 0) return;
  for (const o of ctx.recList) {
    const os = o.state;
    if (o === direct || !os.alive || os.nation === p.nation) continue;
    const d = Math.hypot(os.pos[0] - x, os.pos[1] - y, os.pos[2] - z) - ctx.frames[os.frame].radius;
    if (d >= p.splash) continue;
    const fall = Math.max(1 - Math.max(d, 0) / p.splash, SPLASH_MIN_FRACTION);
    hitShip(ctx, o, p.damage * fall, p.owner, p.id, x, y, z);
  }
}

/** Advance all Projectiles one tick: homing, swept terrain/wall/Ship tests, expiry. */
export function stepProjectiles(ctx: SimCtx): void {
  const dt = ctx.dt;
  const ray = ctx.ray;
  for (let i = ctx.projectiles.length - 1; i >= 0; i--) {
    const p = ctx.projectiles[i]!;
    const age = ctx.tick - p.spawnTick;

    if (p.homing > 0 && p.target) {
      const t = ctx.ships.get(p.target);
      if (!t || !t.state.alive || t.flareTicks > 0) {
        p.target = null;
      } else {
        let tx = t.state.pos[0] - p.x,
          ty = t.state.pos[1] - p.y,
          tz = t.state.pos[2] - p.z;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl;
        ty /= tl;
        tz /= tl;
        const cosA = Math.min(Math.max(p.dx * tx + p.dy * ty + p.dz * tz, -1), 1);
        const angle = Math.acos(cosA);
        const maxTurn = p.homing * dt;
        const frac = angle <= maxTurn ? 1 : maxTurn / angle;
        let nx = p.dx + (tx - p.dx) * frac,
          ny = p.dy + (ty - p.dy) * frac,
          nz = p.dz + (tz - p.dz) * frac;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        p.dx = nx;
        p.dy = ny;
        p.dz = nz;
      }
    }

    const step = Math.min(p.speed * dt, Math.max(p.range - p.travelled, 0));
    const x1 = p.x + p.dx * step,
      y1 = p.y + p.dy * step,
      z1 = p.z + p.dz * step;
    let hitT = Infinity; // distance along the step
    let victim: ShipRec | null = null;

    if (p.kind !== 'flare' && step > 0) {
      ray.origin.x = p.x;
      ray.origin.y = p.y;
      ray.origin.z = p.z;
      ray.dir.x = p.dx;
      ray.dir.y = p.dy;
      ray.dir.z = p.dz;
      const hit = ctx.world.castRay(ray, step, true, undefined, RAY_QUERY_GROUPS);
      if (hit) hitT = hit.timeOfImpact;

      const testTick = ctx.tick - Math.max(0, p.rewind - age);
      for (const o of ctx.recList) {
        const os = o.state;
        if (!os.alive || os.nation === p.nation || os.rollTicks > 0) continue;
        const fd = ctx.frames[os.frame];
        poseAt(ctx, o, testTick);
        const reach = fd.halfLength + PROJECTILE_RADIUS + step;
        if (
          Math.abs(_cx - p.x) > reach ||
          Math.abs(_cy - p.y) > reach ||
          Math.abs(_cz - p.z) > reach
        )
          continue;
        const r = fd.radius + PROJECTILE_RADIUS;
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
          victim = o;
        }
      }
      for (const w of ctx.walls) {
        if (w.nation === p.nation) continue;
        if (Math.hypot(x1 - w.x, y1 - w.y, z1 - w.z) < WALL_RADIUS && hitT === Infinity)
          hitT = step;
      }
    }

    if (hitT !== Infinity) {
      const hx = p.x + p.dx * hitT,
        hy = p.y + p.dy * hitT,
        hz = p.z + p.dz * hitT;
      explode(ctx, p, hx, hy, hz, victim);
      ctx.events.push({ type: 'projectileExpired', id: p.id, pos: [hx, hy, hz] });
      recycle(ctx, i);
      continue;
    }
    p.x = x1;
    p.y = y1;
    p.z = z1;
    p.travelled += step;
    if (p.travelled >= p.range - 1e-6) {
      ctx.events.push({ type: 'projectileExpired', id: p.id, pos: [p.x, p.y, p.z] });
      recycle(ctx, i);
    }
  }
  for (let i = ctx.walls.length - 1; i >= 0; i--)
    if (ctx.walls[i]!.expireTick <= ctx.tick) ctx.walls.splice(i, 1);
}
