import { SKILLS } from '../content/weapons';
import { TICK_HZ, type NationId, type ShipId, type SkillDef, type SkillId } from '../types';
import type { ShipRec, SimCtx } from './ctx';
import {
  PURGE_RADIUS,
  DAMAGE_AURA_RADIUS,
  QUAKE_DAMAGE,
  QUAKE_DISTANCE,
  QUAKE_RADIUS,
  HEAL_FIELD_HP,
  HEAL_FIELD_SHIELD,
  HEAL_BEAM_HP,
  CHARGE_BEAM_SHIELD,
  REPAIR_KIT_FRACTION,
  SHIELD_KIT_FRACTION,
  SNARE_CONE_RAD,
  SNARE_RANGE,
  BREACH_RADIUS,
  HEAL_FIELD_RADIUS,
  HEAL_BEAM_RANGE,
  DISPEL_RANGE,
  SCAN_RADIUS,
} from './constants';
import { applyBuff, breakCloak, dropBuffs, isCloaked, isDebuff, tickBuffs } from './buffs';
import { toggleSiege } from './flight';
import { forwardOf } from './math';
import { damageShip } from './damage';

const _f = [0, 0, 0];

/** Skills that change movement and therefore must also run in client prediction. */
const PREDICTED = new Set([
  'afterburn-dash',
  'siege-anchor',
  'air-siege',
  'pivot-flip',
  'backdraft',
  'fuel-cell',
]);

/** Buff effects that change flight (predicted like PREDICTED Skills). */
function affectsFlight(e: SkillDef['buff']): boolean {
  return (
    !!e &&
    (e.speedMul !== undefined ||
      e.turnRateMul !== undefined ||
      e.rollCooldownMul !== undefined ||
      e.groundSpeedMul !== undefined)
  );
}

/** Skills that only work while Grounded. */
const GROUND_ONLY = new Set(['ground-shroud', 'track-drive']);

export function tickTimers(rec: ShipRec): void {
  const s = rec.state;
  for (let i = 0; i < s.cooldowns.length; i++) if (s.cooldowns[i]! > 0) s.cooldowns[i]!--;
  tickBuffs(s);
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
  const fd = rec.fd;
  const def = SKILLS[id];
  if (!def || !s.alive) return false;
  if (def.frames !== 'all' && !def.frames.includes(s.frame)) return false;
  const movesShip = def.kind === 'buff' && affectsFlight(def.buff);
  if (predictOnly && !PREDICTED.has(id) && !movesShip) return false;
  if (GROUND_ONLY.has(id) && !s.grounded) return false;
  const ticks = Math.ceil(def.durationSec * TICK_HZ);
  forwardOf(s.rot, _f);

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
    if (def.buff.absorbHits) rec.absorbLeft = def.buff.absorbHits;
  } else if (def.kind === 'toggle' && def.toggleGroup) {
    // Pressing the active mode turns it off; another mode of the group switches to it.
    if (s.toggles[def.toggleGroup] === id) delete s.toggles[def.toggleGroup];
    else s.toggles[def.toggleGroup] = id;
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
        for (let k = a.state.buffs.length - 1; k >= 0; k--)
          if (isDebuff(a.state.buffs[k]!.skill)) a.state.buffs.splice(k, 1);
        for (const o of ctx.recList) {
          if (o.state.lockTarget === a.state.id) o.state.lockTarget = null;
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
      s.shield = Math.min(s.maxShield, s.shield + s.maxShield * SHIELD_KIT_FRACTION);
      break;
    case 'fuel-cell':
      s.fuel = 1;
      break;
    case 'siege-anchor':
    case 'air-siege':
      if (!toggleSiege(rec, id === 'siege-anchor')) return false;
      break;
    case 'snare-tag':
    case 'shield-breaker':
    case 'blind-tag': {
      const foe = nearestEnemyInFront(ctx, rec, SNARE_RANGE, SNARE_CONE_RAD);
      if (foe) {
        applyBuff(foe.state, id, s.id, ticks);
        targets = [foe.state.id];
      }
      break;
    }
    case 'dispel-lance': {
      const foe = nearestEnemyInFront(ctx, rec, DISPEL_RANGE, SNARE_CONE_RAD);
      if (foe) {
        foe.state.buffs.length = 0;
        targets = [foe.state.id];
      }
      break;
    }
    case 'scan-pulse':
      targets = [];
      for (const o of ctx.recList) {
        const os = o.state;
        if (
          !os.alive ||
          os.nation === s.nation ||
          !isCloaked(os) ||
          dist(os.pos, s.pos) > SCAN_RADIUS
        )
          continue;
        breakCloak(os);
        targets.push(os.id);
      }
      break;
    case 'renewal-pulse':
    case 'recharge-pulse':
      targets = [];
      for (const o of ctx.recList) {
        const os = o.state;
        if (!os.alive || os.nation !== s.nation || dist(os.pos, s.pos) > HEAL_FIELD_RADIUS)
          continue;
        if (id === 'renewal-pulse') os.hp = Math.min(os.maxHp, os.hp + os.maxHp * HEAL_FIELD_HP);
        else os.shield = Math.min(os.maxShield, os.shield + os.maxShield * HEAL_FIELD_SHIELD);
        if (o !== rec) targets.push(os.id);
      }
      break;
    case 'mend-beam':
    case 'lifeline': {
      const a = mostHurtAlly(ctx, rec, HEAL_BEAM_RANGE);
      const as = a.state;
      if (id === 'mend-beam') as.hp = Math.min(as.maxHp, as.hp + as.maxHp * HEAL_BEAM_HP);
      else {
        // HP and shield only: fuel moves the Ship, and this cast isn't predicted.
        as.hp = as.maxHp;
        as.shield = as.maxShield;
      }
      if (a !== rec) targets = [as.id];
      break;
    }
    case 'charge-beam': {
      const a = mostHurtAlly(ctx, rec, HEAL_BEAM_RANGE, true);
      const as = a.state;
      as.shield = Math.min(as.maxShield, as.shield + as.maxShield * CHARGE_BEAM_SHIELD);
      if (a !== rec) targets = [as.id];
      break;
    }
    case 'quake-round': {
      const x = s.pos[0] + _f[0]! * QUAKE_DISTANCE,
        y = s.pos[1] + _f[1]! * QUAKE_DISTANCE,
        z = s.pos[2] + _f[2]! * QUAKE_DISTANCE;
      targets = hurtEnemiesNear(
        ctx,
        s.nation,
        s.id,
        x,
        y,
        z,
        QUAKE_RADIUS,
        QUAKE_DAMAGE * rec.mods.damageMul,
      );
      break;
    }
    case 'core-breach':
      // Damage = current HP, then the Ship goes with it (no killer: a self-destruct).
      targets = hurtEnemiesNear(
        ctx,
        s.nation,
        s.id,
        s.pos[0],
        s.pos[1],
        s.pos[2],
        BREACH_RADIUS,
        s.hp,
      );
      dropBuffs(s, (e) => e.invulnerable === true);
      rec.mods.invulnerable = false;
      if (slot >= 0) s.cooldowns[slot] = Math.ceil(def.cooldownSec * TICK_HZ);
      ctx.events.push({ type: 'skillUsed', id: s.id as ShipId, skill: id, slot, targets });
      // Big enough to get through any shield-damage buff.
      damageShip(ctx, rec, s.maxHp + s.maxShield * 10, null);
      return true;
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
 * Server-only per-tick Skill effects: heal-over-time, shield rebuild and damage-aura buffs.
 * ponytail: O(ships^2) for damage auras; fine at 60 Ships, spatial grid if it shows in profiles.
 */
export function stepSkillEffects(ctx: SimCtx): void {
  const dt = ctx.dt;
  for (const rec of ctx.recList) {
    const s = rec.state;
    if (!s.alive || s.launchPhase !== 'none') continue;
    if (rec.mods.hpRegenPerSec > 0)
      s.hp = Math.min(s.maxHp, s.hp + s.maxHp * rec.mods.hpRegenPerSec * dt);
    if (rec.mods.shieldRestorePerSec > 0)
      s.shield = Math.min(
        s.maxShield,
        s.shield + s.maxShield * rec.mods.shieldRestorePerSec * rec.mods.shieldRegenMul * dt,
      );
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
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** Damage every live enemy of `nation` within `radius` of a point; returns their ids. */
function hurtEnemiesNear(
  ctx: SimCtx,
  nation: NationId,
  owner: ShipId,
  x: number,
  y: number,
  z: number,
  radius: number,
  amount: number,
): ShipId[] {
  const hit: ShipId[] = [];
  for (const o of ctx.recList) {
    const os = o.state;
    if (!os.alive || os.nation === nation || os.launchPhase !== 'none') continue;
    if (Math.hypot(os.pos[0] - x, os.pos[1] - y, os.pos[2] - z) > radius) continue;
    damageShip(ctx, o, amount * o.mods.damageTakenMul, owner);
    hit.push(os.id);
  }
  return hit;
}

/** Ally (self included) within `range` with the lowest HP (or shield) fraction; the caster if nobody is lower. */
function mostHurtAlly(ctx: SimCtx, rec: ShipRec, range: number, shield = false): ShipRec {
  const s = rec.state;
  const frac = (x: typeof s) => (shield ? x.shield / Math.max(1, x.maxShield) : x.hp / x.maxHp);
  let best = rec;
  let bestF = frac(s);
  for (const o of ctx.recList) {
    const os = o.state;
    if (
      !os.alive ||
      os.nation !== s.nation ||
      os.launchPhase !== 'none' ||
      dist(os.pos, s.pos) > range
    )
      continue;
    const f = frac(os);
    if (f < bestF) {
      best = o;
      bestF = f;
    }
  }
  return best;
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
