import { TURRET } from '../content/bases';
import { WEAPONS } from '../content/weapons';
import type { ShipRec, SimCtx, StructureRec } from './ctx';
import { interceptTime, spawnProjectile } from './combat';
import { RAY_QUERY_GROUPS } from './constants';

const _aim = [0, 0, 0];

/** Base Turrets (authoritative): pick the nearest visible enemy Ship, slew toward its lead point, fire. */
export function stepTurrets(ctx: SimCtx): void {
  const w = WEAPONS[TURRET.weapon]!;
  for (const st of ctx.structures) {
    const s = st.state;
    if (s.kind !== 'turret' || !s.alive) continue;
    st.fireCd = Math.max(st.fireCd - ctx.dt, 0);
    const px = s.pos[0],
      py = s.pos[1] + st.height,
      pz = s.pos[2];
    const target = pickTarget(ctx, st, px, py, pz, w.rangeM);
    if (!target) continue;
    const t = target.state;
    const t0 = interceptTime(
      t.pos[0] - px,
      t.pos[1] - py,
      t.pos[2] - pz,
      t.vel[0],
      t.vel[1],
      t.vel[2],
      w.speed,
    );
    const lead = Math.min(t0, w.rangeM / w.speed);
    let ax = t.pos[0] + t.vel[0] * lead - px,
      ay = t.pos[1] + t.vel[1] * lead - py,
      az = t.pos[2] + t.vel[2] * lead - pz;
    const al = Math.hypot(ax, ay, az) || 1;
    ax /= al;
    ay /= al;
    az /= al;
    const a = s.aim;
    const angle = Math.acos(Math.min(Math.max(a[0] * ax + a[1] * ay + a[2] * az, -1), 1));
    const maxTurn = TURRET.turnRateRad * ctx.dt;
    const frac = angle <= maxTurn ? 1 : maxTurn / angle;
    let nx = a[0] + (ax - a[0]) * frac,
      ny = a[1] + (ay - a[1]) * frac,
      nz = a[2] + (az - a[2]) * frac;
    const nl = Math.hypot(nx, ny, nz) || 1;
    a[0] = nx /= nl;
    a[1] = ny /= nl;
    a[2] = nz /= nl;
    if (angle - maxTurn > TURRET.fireConeRad || st.fireCd > 0) continue;
    st.fireCd = w.fireIntervalSec;
    // Spread: random offset in a box around the barrel, renormalised (cheap cone).
    _aim[0] = nx + (ctx.rng() - 0.5) * 2 * w.spread;
    _aim[1] = ny + (ctx.rng() - 0.5) * 2 * w.spread;
    _aim[2] = nz + (ctx.rng() - 0.5) * 2 * w.spread;
    const l = Math.hypot(_aim[0]!, _aim[1]!, _aim[2]!);
    spawnProjectile(
      ctx,
      st.shooter,
      w.kind,
      w.id,
      w.damage,
      w.splashRadius,
      w.speed,
      w.rangeM,
      0,
      null,
      px + nx * TURRET.muzzleM,
      py + ny * TURRET.muzzleM,
      pz + nz * TURRET.muzzleM,
      _aim[0]! / l,
      _aim[1]! / l,
      _aim[2]! / l,
      0,
    );
  }
}

function pickTarget(
  ctx: SimCtx,
  st: StructureRec,
  px: number,
  py: number,
  pz: number,
  range: number,
): ShipRec | null {
  let best: ShipRec | null = null;
  let bestD = range;
  for (const rec of ctx.recList) {
    const s = rec.state;
    if (!s.alive || s.nation === st.state.nation || s.launchPhase !== 'none') continue;
    const d = Math.hypot(s.pos[0] - px, s.pos[1] - py, s.pos[2] - pz);
    if (d >= bestD || d < 1) continue;
    const ray = ctx.ray;
    ray.origin.x = px;
    ray.origin.y = py;
    ray.origin.z = pz;
    ray.dir.x = (s.pos[0] - px) / d;
    ray.dir.y = (s.pos[1] - py) / d;
    ray.dir.z = (s.pos[2] - pz) / d;
    const hit = ctx.world.castRay(ray, d, true, undefined, RAY_QUERY_GROUPS, st.collider);
    if (hit && hit.timeOfImpact < d - ctx.frames[s.frame].radius) continue;
    best = rec;
    bestD = d;
  }
  return best;
}
