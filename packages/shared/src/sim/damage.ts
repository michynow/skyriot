import { RESPAWN_SEC } from '../content/frames';
import { TICK_HZ, type ShipId } from '../types';
import type { SimCtx, ShipRec } from './ctx';
import {
  DEFLECT_CAP,
  DEFLECT_DAMAGE_MUL,
  GHOST_DEFLECT_BONUS,
  IRON_HIDE_DAMAGE_MUL,
} from './constants';

/** Shield first, then HP. Handles god, roll invulnerability and death. Returns damage actually dealt. */
export function damageShip(
  ctx: SimCtx,
  rec: ShipRec,
  amount: number,
  killer: ShipId | null,
): number {
  const s = rec.state;
  if (!s.alive || amount <= 0 || s.rollTicks > 0 || ctx.tuning.god.has(s.id)) return 0;
  rec.shieldDelay = ctx.frames[s.frame].shieldRegenDelaySec;
  let remaining = amount;
  const absorbed = Math.min(s.shield, remaining);
  s.shield -= absorbed;
  remaining -= absorbed;
  s.hp -= remaining;
  if (s.hp <= 0) {
    s.hp = 0;
    s.alive = false;
    s.speed = 0;
    s.vel[0] = s.vel[1] = s.vel[2] = 0;
    rec.lat[0] = rec.lat[1] = rec.lat[2] = 0;
    s.lockTarget = null;
    s.respawnAtTick = ctx.tick + Math.ceil(RESPAWN_SEC * TICK_HZ);
    ctx.events.push({
      type: 'shipDestroyed',
      victim: s.id,
      killer,
      pos: [s.pos[0], s.pos[1], s.pos[2]],
    });
  }
  return amount;
}

/** Projectile damage: Deflect (capped, except Ghost Skin) and Iron Hide, then applies. */
export function hitShip(
  ctx: SimCtx,
  rec: ShipRec,
  base: number,
  attacker: ShipId,
  projectile: number,
  x: number,
  y: number,
  z: number,
): void {
  const s = rec.state;
  if (!s.alive || s.rollTicks > 0) return;
  const chance =
    Math.min(ctx.frames[s.frame].deflectChance, DEFLECT_CAP) +
    (rec.ghostTicks > 0 ? GHOST_DEFLECT_BONUS : 0);
  const deflected = ctx.rng() < chance;
  let dmg = base;
  if (deflected) dmg *= DEFLECT_DAMAGE_MUL;
  if (rec.ironTicks > 0) dmg *= IRON_HIDE_DAMAGE_MUL;
  const dealt = damageShip(ctx, rec, dmg, attacker);
  ctx.events.push({
    type: 'hit',
    projectile,
    attacker,
    victim: s.id,
    damage: dealt,
    deflected,
    pos: [x, y, z],
  });
}
