import { SKILLS } from '../content/weapons';
import type { ShipId, ShipState, SkillId } from '../types';
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
    lockTimeMul: 1,
    splashMul: 1,
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
  m.maxHpMul = m.shieldRegenMul = m.fuelRegenMul = m.lockTimeMul = m.splashMul = 1;
  m.deflectAdd = 0;
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
    m.lockTimeMul *= e.lockTimeMul ?? 1;
    m.splashMul *= e.splashMul ?? 1;
    m.deflectAdd += e.deflectAdd ?? 0;
  }
  if (!s.alive) return;
  const target = ctx.frames[s.frame].maxHp * m.maxHpMul;
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

/** Count down buffs and drop expired ones. */
export function tickBuffs(s: ShipState): void {
  for (let i = s.buffs.length - 1; i >= 0; i--) {
    const b = s.buffs[i]!;
    if (--b.ticksLeft <= 0) s.buffs.splice(i, 1);
  }
}

/** Default mode of each toggle group = the first toggle Skill of that group on the hotbar. */
export function initToggles(s: ShipState, hotbar: (SkillId | null)[]): void {
  for (const key of Object.keys(s.toggles)) delete s.toggles[key];
  for (const id of hotbar) {
    const def = id ? SKILLS[id] : undefined;
    if (def?.kind === 'toggle' && def.toggleGroup && !(def.toggleGroup in s.toggles)) {
      s.toggles[def.toggleGroup] = def.id;
    }
  }
}
