import { SKILLS } from '../content/weapons';
import type { BuffEffect, ShipId, ShipState, SkillId } from '../types';
import type { BuffMods, ShipRec, SimCtx } from './ctx';

export function createMods(): BuffMods {
  return {
    fireRateMul: 1,
    speedMul: 1,
    turnRateMul: 1,
    deflectAdd: 0,
    damageMul: 1,
    damageTakenMul: 1,
    maxHpMul: 1,
    shieldRegenMul: 1,
    fuelRegenMul: 1,
    accuracyAdd: 0,
    splashMul: 1,
    hpRegenPerSec: 0,
    cloak: false,
    damageAuraDps: 0,
    salvoAdd: 0,
    primaryDamageMul: 1,
    secondaryDamageMul: 1,
    secondaryFireRateMul: 1,
    spreadMul: 1,
    lockConeMul: 1,
    shieldDamageTakenMul: 1,
    secondaryDamageTakenMul: 1,
    collisionDamageMul: 1,
    invulnerable: false,
    noAttack: false,
    rollCooldownMul: 1,
    groundSpeedMul: 1,
    shieldRestorePerSec: 0,
    missileBlind: false,
    primaryShotMul: 1,
  };
}

/**
 * Resolve the Ship's buff stack into one set of modifiers (multiply the multipliers, add the
 * additions) and apply max-HP changes. Runs once per tick, before flight, on server and client.
 */
export function resolveMods(ctx: SimCtx, rec: ShipRec): void {
  const m = rec.mods;
  const s = rec.state;
  m.fireRateMul = m.speedMul = m.turnRateMul = m.damageMul = m.damageTakenMul = 1;
  m.maxHpMul = m.shieldRegenMul = m.fuelRegenMul = m.splashMul = 1;
  m.primaryDamageMul = m.secondaryDamageMul = m.secondaryFireRateMul = m.spreadMul = 1;
  m.lockConeMul = m.shieldDamageTakenMul = m.secondaryDamageTakenMul = m.collisionDamageMul = 1;
  m.rollCooldownMul = m.groundSpeedMul = m.primaryShotMul = 1;
  m.deflectAdd =
    m.accuracyAdd =
    m.hpRegenPerSec =
    m.damageAuraDps =
    m.salvoAdd =
    m.shieldRestorePerSec =
      0;
  m.cloak = m.invulnerable = m.noAttack = m.missileBlind = false;
  for (const b of s.buffs) {
    const e = SKILLS[b.skill]?.buff;
    if (!e) continue;
    m.fireRateMul *= e.fireRateMul ?? 1;
    m.speedMul *= e.speedMul ?? 1;
    m.turnRateMul *= e.turnRateMul ?? 1;
    m.damageMul *= e.damageMul ?? 1;
    m.damageTakenMul *= e.damageTakenMul ?? 1;
    m.maxHpMul *= e.maxHpMul ?? 1;
    m.shieldRegenMul *= e.shieldRegenMul ?? 1;
    m.fuelRegenMul *= e.fuelRegenMul ?? 1;
    m.accuracyAdd += e.accuracyAdd ?? 0;
    m.splashMul *= e.splashMul ?? 1;
    m.deflectAdd += e.deflectAdd ?? 0;
    m.hpRegenPerSec += e.hpRegenPerSec ?? 0;
    m.damageAuraDps += e.damageAuraDps ?? 0;
    m.salvoAdd += e.salvoAdd ?? 0;
    m.primaryDamageMul *= e.primaryDamageMul ?? 1;
    m.secondaryDamageMul *= e.secondaryDamageMul ?? 1;
    m.secondaryFireRateMul *= e.secondaryFireRateMul ?? 1;
    m.spreadMul *= e.spreadMul ?? 1;
    m.lockConeMul *= e.lockConeMul ?? 1;
    m.shieldDamageTakenMul *= e.shieldDamageTakenMul ?? 1;
    m.secondaryDamageTakenMul *= e.secondaryDamageTakenMul ?? 1;
    m.collisionDamageMul *= e.collisionDamageMul ?? 1;
    m.rollCooldownMul *= e.rollCooldownMul ?? 1;
    m.groundSpeedMul *= e.groundSpeedMul ?? 1;
    m.primaryShotMul *= e.primaryShotMul ?? 1;
    m.shieldRestorePerSec += e.shieldRestorePerSec ?? 0;
    m.cloak ||= e.cloak === true;
    m.invulnerable ||= e.invulnerable === true;
    m.noAttack ||= e.noAttack === true;
    m.missileBlind ||= e.missileBlind === true;
  }
  if (!s.alive) return;
  const target = rec.fd.maxHp * m.maxHpMul;
  if (Math.abs(target - s.maxHp) > 1e-6) {
    // Keep the HP fraction when max HP rises or reverts.
    s.hp = Math.max((s.hp * target) / s.maxHp, 1);
    s.maxHp = target;
  }
}

/** Add or refresh (no stacking) a timed buff. */
export function applyBuff(s: ShipState, skill: SkillId, source: ShipId, ticks: number): void {
  for (const b of s.buffs) {
    if (b.skill === skill) {
      b.source = source;
      b.ticksLeft = ticks;
      return;
    }
  }
  s.buffs.push({ skill, source, ticksLeft: ticks });
}

/** Shroud Veil (or any cloak buff) is up. Derived from `buffs`, so the client sees it too. */
export function isCloaked(s: ShipState): boolean {
  for (const b of s.buffs) if (SKILLS[b.skill]?.buff?.cloak) return true;
  return false;
}

/** Drop every cloak buff (the Ship fired, or was scanned). */
export function breakCloak(s: ShipState): void {
  dropBuffs(s, (e) => e.cloak === true);
}

/** Remove the buffs whose effect matches. */
export function dropBuffs(s: ShipState, match: (e: BuffEffect) => boolean): void {
  for (let i = s.buffs.length - 1; i >= 0; i--) {
    const e = SKILLS[s.buffs[i]!.skill]?.buff;
    if (e && match(e)) s.buffs.splice(i, 1);
  }
}

/** A buff a hostile Skill put on the Ship (enemy debuff), as opposed to an own or ally buff. */
export function isDebuff(skill: SkillId): boolean {
  return SKILLS[skill]?.kind === 'skill';
}

/** Count down buffs and drop expired ones. */
export function tickBuffs(s: ShipState): void {
  for (let i = s.buffs.length - 1; i >= 0; i--) {
    const b = s.buffs[i]!;
    if (--b.ticksLeft <= 0) s.buffs.splice(i, 1);
  }
}

/** Every toggle group starts off (e.g. no bombing mode: the Secondary fires normally). */
export function initToggles(s: ShipState): void {
  for (const key of Object.keys(s.toggles)) delete s.toggles[key];
}
