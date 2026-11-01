import { SKILLS } from '../content/weapons';
import { TICK_HZ, type NationId, type ShipId, type SkillId } from '../types';
import type { ShipRec, SimCtx } from './ctx';
import {
  PURGE_RADIUS,
  CINDER_DPS,
  CINDER_MAX,
  CINDER_RADIUS,
  DAMAGE_AURA_RADIUS,
  FLARE_COUNT,
  FLARE_RANGE,
  FLARE_SPEED,
  QUAKE_DAMAGE,
  QUAKE_DISTANCE,
  QUAKE_RADIUS,
  REPAIR_KIT_FRACTION,
  SAP_RADIUS,
  SNARE_CONE_RAD,
  SNARE_RANGE,
} from './constants';
import { applyBuff, tickBuffs } from './buffs';
import { toggleSiege } from './flight';
import { forwardOf, rightOf } from './math';
import { spawnProjectile } from './combat';
import { damageShip } from './damage';

const _f = [0, 0, 0];
const _r = [0, 0, 0];

/** Skills that change movement and therefore must also run in client prediction. */
const PREDICTED = new Set(['afterburn-dash', 'siege-anchor', 'pivot-flip', 'backdraft']);

export function tickTimers(rec: ShipRec): void {
  const s = rec.state;
  for (let i = 0; i < s.cooldowns.length; i++) if (s.cooldowns[i]! > 0) s.cooldowns[i]!--;
  tickBuffs(s);
  if (rec.state.flareTicks > 0) rec.state.flareTicks--;
}

export function useHotbar(ctx: SimCtx, rec: ShipRec, slot: number, predictOnly: boolean): void {
  const s = rec.state;
  if (slot < 0 || slot >= s.cooldowns.length || s.cooldowns[slot]! > 0 || !s.alive) return;
  const id = ctx.frames[s.frame].hotbar[slot];
  if (id) castSkill(ctx, rec, id, slot, predictOnly);
}

/**
 * Cast a Skill of the Ship's Frame kit. `slot` is the hotbar slot that pays the cooldown (-1 = none, dev
 * casts of kit Skills that aren't on the hotbar). Returns false if the Skill can't be cast.
 */
export function castSkill(
  ctx: SimCtx,
  rec: ShipRec,
  id: SkillId,
  slot: number,
  predictOnly: boolean,
): boolean {
  const s = rec.state;
  const fd = ctx.frames[s.frame];
  const def = SKILLS[id];
  if (!def || !s.alive) return false;
  if (def.frames !== 'all' && !def.frames.includes(s.frame)) return false;
  const movesShip =
    def.kind === 'buff' &&
    (def.buff?.speedMul !== undefined || def.buff?.turnRateMul !== undefined);
  if (predictOnly && !PREDICTED.has(id) && !movesShip) return false;
  if (def.kind === 'toggle' && def.toggleGroup && s.toggles[def.toggleGroup] === id) return false;
  const ticks = Math.ceil(def.durationSec * TICK_HZ);
  forwardOf(s.rot, _f);
  rightOf(s.rot, _r);

  let targets: ShipId[] | undefined;
  if (def.kind === 'buff' && def.buff) {
    const radius = def.auraRadiusM;
    if (radius !== undefined) {
      targets = [];
      for (const o of ctx.recList) {
        const os = o.state;
        if (!os.alive || os.nation !== s.nation) continue;
        if (Math.hypot(os.pos[0] - s.pos[0], os.pos[1] - s.pos[1], os.pos[2] - s.pos[2]) > radius)
          continue;
        if (predictOnly && o !== rec) continue;
        applyBuff(os, id, s.id, ticks);
        if (o !== rec) targets.push(os.id);
      }
    } else {
      applyBuff(s, id, s.id, ticks);
    }
  } else if (def.kind === 'toggle' && def.toggleGroup) {
    s.toggles[def.toggleGroup] = id;
    // Switching modes costs the cooldown on every slot of the group.
    const cd = Math.ceil(def.cooldownSec * TICK_HZ);
    for (let j = 0; j < fd.hotbar.length; j++) {
      if (SKILLS[fd.hotbar[j] ?? '']?.toggleGroup === def.toggleGroup) s.cooldowns[j] = cd;
    }
  }

  switch (id) {
    case 'purge': {
      const allies: ShipRec[] = [];
      for (const o of ctx.recList) {
        const os = o.state;
        if (!os.alive || os.nation !== s.nation) continue;
        if (
          Math.hypot(os.pos[0] - s.pos[0], os.pos[1] - s.pos[1], os.pos[2] - s.pos[2]) <=
          PURGE_RADIUS
        )
          allies.push(o);
      }
      targets = [];
      for (const a of allies) {
        if (a !== rec) targets.push(a.state.id);
        for (const o of ctx.recList) {
          if (o.state.lockTarget === a.state.id) {
            o.state.lockTarget = null;
            o.lockCand = null;
            o.lockTime = 0;
          }
        }
        for (const p of ctx.projectiles) {
          if (p.kind === 'missile' && p.target === a.state.id) {
            p.target = null;
            p.homing = 0;
            ctx.events.push({
              type: 'missileEvaded',
              id: p.id,
              victim: a.state.id,
              reason: 'purge',
            });
          }
        }
      }
      break;
    }
    case 'flares':
      rec.state.flareTicks = Math.max(ticks, 1);
      s.lockTarget = null;
      for (const o of ctx.recList) if (o.state.lockTarget === s.id) o.state.lockTarget = null;
      // Guided missiles drop their target (reason 'flare') in stepProjectiles while flares are active.
      for (let i = 0; i < FLARE_COUNT; i++) {
        const side = i === 0 ? -1 : 1;
        let dx = -_f[0]! + _r[0]! * side * 0.5,
          dy = -_f[1]! - 0.2,
          dz = -_f[2]! + _r[2]! * side * 0.5;
        const dl = Math.hypot(dx, dy, dz);
        dx /= dl;
        dy /= dl;
        dz /= dl;
        spawnProjectile(
          ctx,
          rec,
          'flare',
          'flare',
          0,
          0,
          FLARE_SPEED,
          FLARE_RANGE,
          0,
          null,
          s.pos[0],
          s.pos[1],
          s.pos[2],
          dx,
          dy,
          dz,
          0,
        );
      }
      break;
    case 'afterburn-dash':
      rec.state.dashTicks = Math.max(ticks, 1);
      s.speed = Math.max(s.speed, fd.boostSpeed);
      break;
    case 'pivot-flip':
      // The steering aim is flipped client-side; the sim only lifts the turn-rate cap.
      s.flipTicks = Math.max(ticks, 1);
      s.halted = false;
      break;
    case 'backdraft':
      s.reverseTicks = Math.max(ticks, 1);
      s.halted = false;
      break;
    case 'repair-kit':
      s.hp = Math.min(s.maxHp, s.hp + s.maxHp * REPAIR_KIT_FRACTION);
      break;
    case 'shield-kit':
      s.shield = s.maxShield;
      break;
    case 'fuel-cell':
      s.fuel = 1;
      break;
    case 'siege-anchor':
      toggleSiege(rec);
      break;
    case 'snare-tag': {
      const foe = nearestEnemyInFront(ctx, rec, SNARE_RANGE, SNARE_CONE_RAD);
      if (foe) {
        applyBuff(foe.state, id, s.id, ticks);
        targets = [foe.state.id];
      }
      break;
    }
    case 'sapping-hex':
      targets = debuffEnemiesNear(
        ctx,
        s.nation,
        s.pos[0],
        s.pos[1],
        s.pos[2],
        SAP_RADIUS,
        id,
        s.id,
        ticks,
      );
      break;
    case 'quake-round': {
      const x = s.pos[0] + _f[0]! * QUAKE_DISTANCE,
        y = s.pos[1] + _f[1]! * QUAKE_DISTANCE,
        z = s.pos[2] + _f[2]! * QUAKE_DISTANCE;
      targets = debuffEnemiesNear(ctx, s.nation, x, y, z, QUAKE_RADIUS, id, s.id, ticks);
      for (const t of targets) {
        const o = ctx.ships.get(t)!;
        damageShip(ctx, o, QUAKE_DAMAGE * rec.mods.damageMul * o.mods.damageTakenMul, s.id);
      }
      break;
    }
    case 'cinder-cloud':
      if (ctx.zones.length >= CINDER_MAX) ctx.zones.shift();
      ctx.zones.push({
        x: s.pos[0],
        y: s.pos[1],
        z: s.pos[2],
        radius: CINDER_RADIUS,
        dps: CINDER_DPS * rec.mods.damageMul,
        nation: s.nation,
        owner: s.id,
        expireTick: ctx.tick + ticks,
      });
      break;
  }
  if (slot >= 0) s.cooldowns[slot] = Math.ceil(def.cooldownSec * TICK_HZ);
  ctx.events.push(
    targets && targets.length > 0
      ? { type: 'skillUsed', id: s.id as ShipId, skill: id, slot, targets }
      : { type: 'skillUsed', id: s.id as ShipId, skill: id, slot },
  );
  return true;
}

/**
 * Server-only per-tick Skill effects: heal-over-time and damage-aura buffs, and Cinder Cloud zones.
 * ponytail: O(ships^2) for damage auras; fine at 60 Ships, spatial grid if it shows in profiles.
 */
export function stepSkillEffects(ctx: SimCtx): void {
  const dt = ctx.dt;
  for (const rec of ctx.recList) {
    const s = rec.state;
    if (!s.alive || s.launchPhase !== 'none') continue;
    if (rec.mods.hpRegenPerSec > 0)
      s.hp = Math.min(s.maxHp, s.hp + s.maxHp * rec.mods.hpRegenPerSec * dt);
    if (rec.mods.damageAuraDps > 0)
      hurtEnemiesNear(
        ctx,
        s.nation,
        s.id,
        s.pos[0],
        s.pos[1],
        s.pos[2],
        DAMAGE_AURA_RADIUS,
        rec.mods.damageAuraDps * rec.mods.damageMul * dt,
      );
  }
  for (let i = ctx.zones.length - 1; i >= 0; i--) {
    const z = ctx.zones[i]!;
    if (z.expireTick <= ctx.tick) ctx.zones.splice(i, 1);
    else hurtEnemiesNear(ctx, z.nation, z.owner, z.x, z.y, z.z, z.radius, z.dps * dt);
  }
}

function hurtEnemiesNear(
  ctx: SimCtx,
  nation: NationId,
  owner: ShipId,
  x: number,
  y: number,
  z: number,
  radius: number,
  amount: number,
): void {
  for (const o of ctx.recList) {
    const os = o.state;
    if (!os.alive || os.nation === nation || os.launchPhase !== 'none') continue;
    if (Math.hypot(os.pos[0] - x, os.pos[1] - y, os.pos[2] - z) > radius) continue;
    damageShip(ctx, o, amount * o.mods.damageTakenMul, owner);
  }
}

/** Apply debuff `skill` to every live enemy of `nation` within `radius` of a point; returns their ids. */
function debuffEnemiesNear(
  ctx: SimCtx,
  nation: NationId,
  x: number,
  y: number,
  z: number,
  radius: number,
  skill: SkillId,
  source: ShipId,
  ticks: number,
): ShipId[] {
  const hit: ShipId[] = [];
  for (const o of ctx.recList) {
    const os = o.state;
    if (!os.alive || os.nation === nation || os.launchPhase !== 'none') continue;
    if (Math.hypot(os.pos[0] - x, os.pos[1] - y, os.pos[2] - z) > radius) continue;
    applyBuff(os, skill, source, ticks);
    hit.push(os.id);
  }
  return hit;
}

/** Nearest live enemy inside a cone off the nose. Needs `_f` = the caster's forward. */
function nearestEnemyInFront(
  ctx: SimCtx,
  rec: ShipRec,
  range: number,
  cone: number,
): ShipRec | null {
  const s = rec.state;
  const minCos = Math.cos(cone);
  let best: ShipRec | null = null;
  let bestD = range;
  for (const o of ctx.recList) {
    const os = o.state;
    if (!os.alive || os.launchPhase !== 'none' || os.nation === s.nation) continue;
    const dx = os.pos[0] - s.pos[0],
      dy = os.pos[1] - s.pos[1],
      dz = os.pos[2] - s.pos[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < bestD && (dx * _f[0]! + dy * _f[1]! + dz * _f[2]!) / (d || 1) >= minCos) {
      best = o;
      bestD = d;
    }
  }
  return best;
}
