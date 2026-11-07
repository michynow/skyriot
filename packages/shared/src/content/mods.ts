import type { ItemKind, ModDef, ModStat } from '../types';

// Mod pool per kind (CONTEXT.md): fixed values, no random ranges (no reroll gambling). Each Mod slot is offered
// three of its kind's Mods on drop; the Pilot picks one, once. Value scales with the item's tier (`modValue`).
// ponytail: no Relic Mods yet (Relic rarity = 3 regular Mods until item-specific Relic lines are written).
const m = (
  kind: ItemKind,
  stat: ModStat,
  label: string,
  base: number,
  perTier: number,
): ModDef => ({
  id: `${kind}-${stat}`,
  kind,
  label,
  base,
  perTier,
  stat,
});

const LIST: ModDef[] = [
  m('weapon', 'damagePct', '+{v}% damage', 4, 1),
  m('weapon', 'fireRatePct', '+{v}% fire rate', 4, 1),
  m('weapon', 'projectileSpeedPct', '+{v}% projectile speed', 6, 1.5),
  m('weapon', 'accuracyAdd', '+{v} accuracy (Primary)', 0.02, 0.005),
  m('weapon', 'validAngleAdd', '+{v}° Valid Angle (Secondary)', 2, 0.5),
  m('weapon', 'ammoPct', '+{v}% ammo', 10, 2),
  m('engine', 'maxSpeedPct', '+{v}% max speed', 3, 0.75),
  m('engine', 'boostSpeedPct', '+{v}% boost speed', 4, 1),
  m('engine', 'turnRatePct', '+{v}% turn rate', 3, 0.75),
  m('engine', 'fuelBurnPct', '{v}% fuel burn', -5, -1),
  m('armor', 'hpPct', '+{v}% HP', 4, 1),
  m('armor', 'shieldPct', '+{v}% shield', 5, 1),
  m('armor', 'shieldRegenPct', '+{v}% shield regen', 6, 1.5),
  m('armor', 'defenceAdd', '+{v} Defence', 0.01, 0.0025),
  m('armor', 'deflectAdd', '+{v} Deflect', 0.01, 0.0025),
  m('radar', 'stdRangePct', '+{v}% STD range', 4, 1),
  m('radar', 'advRangePct', '+{v}% ADV range', 4, 1),
  m('radar', 'validAngleAdd', '+{v}° Valid Angle', 1, 0.25),
];

export const MODS: Record<string, ModDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

/** Mods per item kind (weapon, engine, armor, radar; others carry none). */
export const MOD_POOL: Partial<Record<ItemKind, string[]>> = {};
for (const d of LIST) (MOD_POOL[d.kind] ??= []).push(d.id);

/** A Mod's value on an item of `tier`. */
export function modValue(mod: ModDef, tier: number): number {
  return mod.base + mod.perTier * (tier - 1);
}

/** Mod slots per rarity. */
export const RARITY_MODS = { standard: 0, tuned: 1, custom: 2, prototype: 3, relic: 3 } as const;
