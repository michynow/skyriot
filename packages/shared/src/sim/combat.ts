import { AIM_ASSIST, MISSILE_EVADE } from '../content/frames';
import { WEAPONS } from '../content/weapons';
import { siegeLockConeMul, siegeMods } from './flight';
import {
  LAG_COMP_MAX_MS,
  TICK_HZ,
  type PilotInput,
  type WeaponDef,
  type ProjectileKind,
  type ShipId,
} from '../types';
import type { Projectile, ShipRec, SimCtx } from './ctx';
import {
  LAG_HISTORY_TICKS,
  MORTAR_GUIDE_TURN,
  MORTAR_LOCK_CONE_RAD,
  MORTAR_LOCK_SEC,
  MORTAR_LOFT_RAD,
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
  p.losTime = 0;
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

/** Missiles (and the siege mortar) lock only onto the selected target, if it is an enemy in cone and range. */
function updateLock(ctx: SimCtx, rec: ShipRec, input: PilotInput, sec: WeaponDef): void {
  const s = rec.state;
  let cone = sec.lockConeRad;
  let range = sec.rangeM;
  let lockSec = sec.lockTimeSec;
  if (cone <= 0) {
    if (sec.kind === 'shell' && s.sieged) {
      cone = MORTAR_LOCK_CONE_RAD;
      lockSec = MORTAR_LOCK_SEC;
    } else {
      s.lockTarget = null;
      s.canLock = false;
      s.lockProgress = 0;
      rec.lockCand = null;
      rec.lockTime = 0;
      return;
    }
  }
  if (s.sieged) {
    const mods = siegeMods(s);
    cone *= siegeLockConeMul(s);
    range *= mods.rangeMul;
  }
  const t = input.target ? ctx.ships.get(input.target) : undefined;
  let valid = false;
  if (t && t.state.alive && t.state.nation !== s.nation && t.state.flareTicks === 0) {
    forwardOf(s.rot, _f);
    const dx = t.state.pos[0] - s.pos[0],
      dy = t.state.pos[1] - s.pos[1],
      dz = t.state.pos[2] - s.pos[2];
    const d = Math.hypot(dx, dy, dz);
    valid = d <= range && d >= 1 && (dx * _f[0]! + dy * _f[1]! + dz * _f[2]!) / d >= Math.cos(cone);
  }
  s.canLock = valid;
  if (!valid || !t) {
    s.lockTarget = null;
    s.lockProgress = 0;
    rec.lockCand = null;
    rec.lockTime = 0;
    return;
  }
  if (rec.lockCand === t.state.id) rec.lockTime += ctx.dt;
  else {
    rec.lockCand = t.state.id;
    rec.lockTime = 0;
  }
  s.lockTarget = rec.lockTime >= lockSec ? t.state.id : null;
  s.lockProgress = Math.min(rec.lockTime / lockSec, 1);
}

/** Time for a projectile of `speed` fired from the origin to meet a target moving at (vx,vy,vz). */
function interceptTime(
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

/** Lock-on progress and Primary/Secondary fire for one Ship. */
export function stepWeapons(ctx: SimCtx, rec: ShipRec, input: PilotInput): void {
  const s = rec.state;
  const fd = ctx.frames[s.frame];
  const weapons = [WEAPONS[fd.primary]!, WEAPONS[fd.secondary]!];
  const sec = weapons[1]!;
  updateLock(ctx, rec, input, sec);
  const rewind = Math.min(Math.max(ctx.tick - input.viewTick, 0), MAX_REWIND_TICKS);
  const fire = [input.fire1, input.fire2];
  for (let i = 0; i < 2; i++) {
    rec.fireCd[i] = Math.max(rec.fireCd[i]! - ctx.dt, -ctx.dt);
    const w = weapons[i]!;
    const ammo = i === 0 ? s.ammo1 : s.ammo2;
    if (!fire[i] || rec.fireCd[i]! > 0 || ammo <= 0) continue;
    if (i === 0) s.ammo1--;
    else s.ammo2--;
    rec.fireCd[i] = rec.fireCd[i]! + w.fireIntervalSec;
    forwardOf(s.rot, _f);
    rightOf(s.rot, _r);
    upOf(s.rot, _u);
    const mods = s.sieged ? siegeMods(s) : null;
    const nose = fd.halfLength + NOSE_OFFSET;
    const ox = s.pos[0] + _f[0]! * nose,
      oy = s.pos[1] + _f[1]! * nose,
      oz = s.pos[2] + _f[2]! * nose;
    // Base direction: the nose, or (Primary aim assist) the Target's lead point.
    let bx = _f[0]!,
      by = _f[1]!,
      bz = _f[2]!;
    let spreadScale = 1;
    if (i === 0 && input.target) {
      const t = ctx.ships.get(input.target);
      if (t && t.state.alive && t.state.nation !== s.nation) {
        const tx = t.state.pos[0] - s.pos[0],
          ty = t.state.pos[1] - s.pos[1],
          tz = t.state.pos[2] - s.pos[2];
        const td = Math.hypot(tx, ty, tz) || 1;
        // The assist cone is measured from the nose (the centre crosshair), not the steering aim.
        const cosAim = (tx * _f[0]! + ty * _f[1]! + tz * _f[2]!) / td;
        if (td <= w.rangeM * (mods ? mods.rangeMul : 1) && cosAim >= Math.cos(AIM_ASSIST.coneRad)) {
          const rx = t.state.pos[0] - ox,
            ry = t.state.pos[1] - oy,
            rz = t.state.pos[2] - oz;
          const tt = Math.min(
            interceptTime(rx, ry, rz, t.state.vel[0], t.state.vel[1], t.state.vel[2], w.speed),
            w.rangeM / w.speed,
          );
          bx = rx + t.state.vel[0] * tt;
          by = ry + t.state.vel[1] * tt;
          bz = rz + t.state.vel[2] * tt;
          const bl = Math.hypot(bx, by, bz) || 1;
          bx /= bl;
          by /= bl;
          bz /= bl;
          spreadScale = AIM_ASSIST.spreadMul;
        }
      }
    }
    const ang = ctx.rng() * Math.PI * 2;
    const rad = w.spread * spreadScale * Math.sqrt(ctx.rng());
    const sx = Math.cos(ang) * rad,
      sy = Math.sin(ang) * rad;
    let dx = bx + _r[0]! * sx + _u[0]! * sy;
    let dy = by + _r[1]! * sx + _u[1]! * sy;
    let dz = bz + _r[2]! * sx + _u[2]! * sy;
    const dl = Math.hypot(dx, dy, dz);
    dx /= dl;
    dy /= dl;
    dz /= dl;
    let homing = w.homingTurnRate;
    let target = homing > 0 ? s.lockTarget : null;
    if (i === 1 && w.kind === 'shell' && s.sieged && s.lockTarget) {
      // Siege mortar: loft toward the locked target, mild guidance pulls the shell down onto it.
      const t = ctx.ships.get(s.lockTarget);
      if (t) {
        const tx = t.state.pos[0] - s.pos[0],
          ty = t.state.pos[1] - s.pos[1],
          tz = t.state.pos[2] - s.pos[2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        dx = tx / tl;
        dy = ty / tl + Math.tan(MORTAR_LOFT_RAD);
        dz = tz / tl;
        const ll = Math.hypot(dx, dy, dz);
        dx /= ll;
        dy /= ll;
        dz /= ll;
        homing = MORTAR_GUIDE_TURN;
        target = s.lockTarget;
      }
    }
    spawnProjectile(
      ctx,
      rec,
      w.kind,
      w.id,
      w.damage * (mods ? mods.damageMul : 1),
      w.splashRadius,
      w.speed,
      w.rangeM * (mods ? mods.rangeMul : 1),
      homing,
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
  for (const r of ctx.recList) {
    r.state.incomingDist = -1;
    r.state.incomingTti = -1;
  }
  for (let i = ctx.projectiles.length - 1; i >= 0; i--) {
    const p = ctx.projectiles[i]!;
    const age = ctx.tick - p.spawnTick;

    if (p.homing > 0 && p.target) {
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
        let broke: 'roll' | 'terrain' | 'flare' | null = null;
        if (ts.flareTicks > 0) {
          broke = 'flare';
        } else if (missile) {
          if (ts.rollTicks > 0 && tl < MISSILE_EVADE.rollBreakDistM) {
            broke = 'roll';
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
          const cosA = Math.min(Math.max(p.dx * tx + p.dy * ty + p.dz * tz, -1), 1);
          const angle = Math.acos(cosA);
          const maxTurn = turn * dt;
          const frac = angle <= maxTurn ? 1 : maxTurn / angle;
          let nx = p.dx + (tx - p.dx) * frac,
            ny = p.dy + (ty - p.dy) * frac,
            nz = p.dz + (tz - p.dz) * frac;
          const nl = Math.hypot(nx, ny, nz) || 1;
          p.dx = nx / nl;
          p.dy = ny / nl;
          p.dz = nz / nl;
          if (missile && (ts.incomingDist < 0 || tl < ts.incomingDist)) {
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
