import { LAUNCH } from '../content/bases';
import { SIEGE, SIEGE_AIR } from '../content/frames';
import { TICK_HZ, type ShipId } from '../types';
import { SKILLS } from '../content/weapons';
import type { Projectile, SimCtx, ShipRec } from './ctx';
import { dropBuffs } from './buffs';
import { DEFLECT_CAP, DEFLECT_DAMAGE_MUL } from './constants';
import { DEFENCE_CAP } from './gear';

/**
 * Shield first, then HP. Handles god, roll invulnerability and death. Returns damage actually dealt.
 * Damage from someone (`killer` set) is cut by the victim's Defence; terrain, collisions and self-destruct aren't.
 */
export function damageShip(
  ctx: SimCtx,
  rec: ShipRec,
  amount: number,
  killer: ShipId | null,
): number {
  const s = rec.state;
  if (!s.alive || amount <= 0 || s.rollTicks > 0 || rec.mods.invulnerable) return 0;
  if (ctx.tuning.god.has(s.id)) return 0;
  if (ctx.map.city) return 0; // City = safe zone
  if (s.launchPhase !== 'none') return 0;
  rec.shieldDelay = ctx.frames[s.frame].shieldRegenDelaySec;
  const defence = rec.fd.defence;
  if (defence && killer !== null) amount *= 1 - Math.min(defence, DEFENCE_CAP);
  // Shield damage buffs scale only the part the shield soaks (in shield units).
  const sm = rec.mods.shieldDamageTakenMul;
  const absorbed = Math.min(s.shield, amount * sm);
  s.shield -= absorbed;
  let remaining = amount - absorbed / sm;
  s.hp -= remaining;
  if (s.hp <= 0) {
    s.hp = 0;
    s.alive = false;
    s.speed = 0;
    s.vel[0] = s.vel[1] = s.vel[2] = 0;
    rec.lat[0] = rec.lat[1] = rec.lat[2] = 0;
    s.lockTarget = null;
    s.buffs.length = 0;
    s.respawnAtTick = ctx.tick + Math.ceil(LAUNCH.respawnSec * TICK_HZ);
    ctx.events.push({
      type: 'shipDestroyed',
      victim: s.id,
      killer,
      pos: [s.pos[0], s.pos[1], s.pos[2]],
    });
  }
  return amount;
}

/**
 * Projectile damage: decoys (absorbHits), Deflect (capped, buffs may add past the cap) and damage-taken
 * buffs, then applies.
 */
export function hitShip(
  ctx: SimCtx,
  rec: ShipRec,
  base: number,
  attacker: ShipId,
  p: Projectile,
  x: number,
  y: number,
  z: number,
): void {
  const s = rec.state;
  if (!s.alive || s.rollTicks > 0 || s.launchPhase !== 'none') return;
  const projectile = p.id;
  if (rec.absorbLeft > 0 && s.buffs.some((b) => SKILLS[b.skill]?.buff?.absorbHits)) {
    // A decoy takes the whole hit.
    if (--rec.absorbLeft === 0) dropBuffs(s, (e) => e.absorbHits !== undefined);
    ctx.events.push({
      type: 'hit',
      projectile,
      attacker,
      victim: s.id,
      damage: 0,
      deflected: true,
      pos: [x, y, z],
    });
    return;
  }
  // Evasion vs Secondary weapons: the hit misses outright (guns roll theirs when they fire).
  if (p.kind !== 'tracer' && ctx.rng() < rec.mods.evasionAdv) {
    ctx.events.push({
      type: 'hit',
      projectile,
      attacker,
      victim: s.id,
      damage: 0,
      deflected: true,
      pos: [x, y, z],
    });
    return;
  }
  const chance = Math.min(rec.fd.deflectChance, DEFLECT_CAP) + rec.mods.deflectAdd;
  const deflected = ctx.rng() < chance;
  let dmg = base;
  if (deflected) dmg *= DEFLECT_DAMAGE_MUL;
  dmg *= rec.mods.damageTakenMul;
  if (p.kind !== 'tracer') dmg *= rec.mods.secondaryDamageTakenMul;
  if (s.sieged) dmg *= (s.grounded ? SIEGE : SIEGE_AIR).damageTakenMul;
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
