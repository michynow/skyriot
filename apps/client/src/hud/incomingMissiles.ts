import { isFlying, ownShip, incoming } from './hudStore';

export interface Threat {
  d: number;
  t: number;
  x: number;
  y: number;
  z: number;
}

/** A missile-sized estimate expires if no end signal ever arrives. */
const MAX_AGE_S = 12;

/**
 * Missiles homing on the own Ship, nearest first; [] when none. The ONLY place the warning's data source is chosen:
 * today `incoming` (projectileSpawned with target === own) + ShipState.incomingDist/Tti. When the server sends
 * missileIncoming / missileEnded, feed `incoming` from those in hudStore.handleHudEvent and nothing else changes.
 * ponytail: positions are the straight spawn->own estimate, not the live projectile.
 */
export function incomingThreats(nowMs: number): Threat[] {
  const own = ownShip();
  const out: Threat[] = [];
  // Server field is the end-of-alarm authority: it goes < 0 when the last missile is gone.
  if (!own || !isFlying(own) || own.incomingDist < 0) return out;
  for (const [id, m] of incoming) {
    const age = (nowMs - m.bornMs) / 1000;
    if (age > MAX_AGE_S) {
      incoming.delete(id);
      continue;
    }
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
  if (out[0]) {
    out[0].d = own.incomingDist;
    out[0].t = own.incomingTti;
  } else
    out.push({
      d: own.incomingDist,
      t: own.incomingTti,
      x: own.pos[0],
      y: own.pos[1],
      z: own.pos[2],
    });
  return out;
}
