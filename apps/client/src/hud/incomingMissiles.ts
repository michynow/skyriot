import { world } from '../state/world';
import { isFlying, ownShip, incoming, warned } from './hudStore';

export interface Threat {
  d: number;
  t: number;
  x: number;
  y: number;
  z: number;
}

/** Safety net if a missileEnded is ever lost. */
const MAX_AGE_S = 25;

/**
 * Missiles homing on the own Ship, nearest first; [] when none (= alarm off). Alarm membership comes from the
 * missileIncoming / missileEnded events (`warned`); positions come from the projectileSpawned origin estimate
 * (`incoming`, fallback when the live snapshot missile is absent; `world.missiles` preferred), distance / tti of the nearest from ShipState.incomingDist/Tti when the server sends them.
 * ponytail: positions are the straight spawn->own estimate, not the live projectile.
 */
export function incomingThreats(nowMs: number): Threat[] {
  const own = ownShip();
  const out: Threat[] = [];
  for (const [id, at] of warned) if (nowMs - at > MAX_AGE_S * 1000) warned.delete(id);
  if (!own || !isFlying(own) || warned.size === 0) return out;
  for (const id of warned.keys()) {
    const live = world.missiles.get(id);
    if (live) {
      const d = Math.hypot(
        live.pos[0] - own.pos[0],
        live.pos[1] - own.pos[1],
        live.pos[2] - own.pos[2],
      );
      const [x, y, z] = live.pos;
      out.push({ d, t: d / Math.max(1, Math.hypot(...live.vel)), x, y, z });
      continue;
    }
    const m = incoming.get(id);
    if (!m) continue;
    const age = (nowMs - m.bornMs) / 1000;
    const ox = m.origin[0] - own.pos[0];
    const oy = m.origin[1] - own.pos[1];
    const oz = m.origin[2] - own.pos[2];
    const total = Math.hypot(ox, oy, oz) || 1;
    const d = Math.max(0, total - m.speed * age);
    const k = d / total;
    out.push({
      d,
      t: d / Math.max(1, m.speed),
      x: own.pos[0] + ox * k,
      y: own.pos[1] + oy * k,
      z: own.pos[2] + oz * k,
    });
  }
  out.sort((a, b) => a.d - b.d);
  const near = out[0] ?? { d: 0, t: 0, x: own.pos[0], y: own.pos[1], z: own.pos[2] };
  if (own.incomingDist >= 0) {
    near.d = own.incomingDist;
    near.t = own.incomingTti;
  }
  if (!out[0]) out.push(near);
  return out;
}
