import { itemTier, upgradeMul, type ShipGear } from '../content/economy';
import { ARMORS } from '../content/armors';
import { CHARMS } from '../content/charms';
import { ENGINES } from '../content/engines';
import { FRAMES } from '../content/frames';
import { MODS, modValue } from '../content/mods';
import { RADARS } from '../content/radars';
import { SKILLS, WEAPONS } from '../content/weapons';
import type {
  CharmEffect,
  CosmeticId,
  FrameDef,
  FrameId,
  ItemInstance,
  ModStat,
  PilotProfile,
  SkillId,
  WeaponDef,
} from '../types';

/** Defence (fraction of incoming damage removed) never goes past this. */
export const DEFENCE_CAP = 0.3;
/** Radar ranges grow at half the usual Upgrade rate (+1.5% per step). */
const radarUpgradeMul = (upgrade: number) => 1 + 0.015 * upgrade;
const DEG = Math.PI / 180;

/** A Ship's equipped gear, resolved once when it changes (never per tick). */
export interface ResolvedGear {
  /** FrameDef fields the gear overrides (engine, armor, radar stats, weapon ids, hotbar), laid over the tuned Frame each tick. */
  over: Partial<FrameDef>;
  /** Primary, Secondary with Upgrade damage, Mods and combat Charms applied. */
  weapons: [WeaponDef, WeaponDef];
  /** Visual tier / upgrade: the best equipped item. */
  tier: number;
  upgrade: number;
  cosmetic: CosmeticId | '';
}

/** Chosen Mods of an item, summed per stat at the item's tier (unchosen offers count for nothing). */
function modSums(item: ItemInstance | undefined): Partial<Record<ModStat, number>> {
  const out: Partial<Record<ModStat, number>> = {};
  if (!item?.mods) return out;
  const tier = itemTier(item.def);
  for (const m of item.mods) {
    const def = typeof m === 'string' ? MODS[m] : undefined;
    if (def) out[def.stat] = (out[def.stat] ?? 0) + modValue(def, tier);
  }
  return out;
}

/** Combat Charm effects: same effect doesn't stack, the strongest equipped one counts. */
function charmEffect(charms: ItemInstance[] | undefined): CharmEffect {
  const out: Record<string, number> = {};
  for (const c of charms ?? []) {
    const e = CHARMS[c.def]?.effect;
    if (!e) continue;
    for (const [k, v] of Object.entries(e)) out[k] = Math.max(out[k] ?? 0, v ?? 0);
  }
  return out as CharmEffect;
}

/** Frame kit Skills only, each once (a second copy would get a second cooldown); length = the default bar. */
export function sanitizeHotbar(
  frame: FrameId,
  bar: readonly (SkillId | null)[],
): (SkillId | null)[] {
  const n = FRAMES[frame].hotbar.length;
  const seen = new Set<SkillId>();
  const out: (SkillId | null)[] = [];
  for (let i = 0; i < n; i++) {
    const id = bar[i];
    const def = typeof id === 'string' ? SKILLS[id] : undefined;
    const ok = def && (def.frames === 'all' || def.frames.includes(frame)) && !seen.has(id!);
    if (ok) seen.add(id!);
    out.push(ok ? id! : null);
  }
  return out;
}

/** Consumable charges a Pilot holds: every stack of each Consumable summed. */
export function chargesOf(profile: PilotProfile): Record<SkillId, number> {
  const out: Record<SkillId, number> = {};
  for (const i of profile.items)
    if (i.kind === 'consumable') out[i.def] = (out[i.def] ?? 0) + (i.count ?? 1);
  return out;
}

export function resolveGear(frame: FrameId, gear: ShipGear): ResolvedGear {
  const stock = FRAMES[frame];
  const over: Partial<FrameDef> = {};
  let tier = 1;
  let upgrade = 0;
  for (const item of [gear.primary, gear.secondary, gear.engine, gear.armor, gear.radar]) {
    if (!item) continue;
    tier = Math.max(tier, itemTier(item.def));
    upgrade = Math.max(upgrade, item.upgrade);
  }
  const pct = (v: number | undefined) => 1 + (v ?? 0) / 100;

  const engine = gear.engine && ENGINES[gear.engine.def];
  if (engine) {
    const m = upgradeMul(gear.engine!.upgrade);
    const mod = modSums(gear.engine);
    const { id, name: _name, ...stats } = engine;
    Object.assign(over, stats, {
      engine: id,
      minSpeed: stats.minSpeed * m,
      cruiseSpeed: stats.cruiseSpeed * m,
      maxSpeed: stats.maxSpeed * m * pct(mod.maxSpeedPct),
      boostSpeed: stats.boostSpeed * m * pct(mod.boostSpeedPct),
    });
    if (mod.turnRatePct) over.turnRate = (over.turnRate ?? stock.turnRate) * pct(mod.turnRatePct);
    if (mod.fuelBurnPct)
      over.fuelBurnPerSec = (over.fuelBurnPerSec ?? stock.fuelBurnPerSec) * pct(mod.fuelBurnPct);
  }

  const armor = gear.armor && ARMORS[gear.armor.def];
  const charm = charmEffect(gear.charms);
  if (armor) {
    const m = upgradeMul(gear.armor!.upgrade);
    const mod = modSums(gear.armor);
    over.maxHp = armor.maxHp * m * pct(mod.hpPct);
    over.maxShield = armor.maxShield * m * pct(mod.shieldPct);
    over.shieldRegenPerSec = armor.shieldRegenPerSec * pct(mod.shieldRegenPct);
    over.defence = armor.defence + (mod.defenceAdd ?? 0);
    const deflect = (armor.deflectAdd ?? 0) + (mod.deflectAdd ?? 0);
    if (deflect) over.deflectChance = stock.deflectChance + deflect;
  }
  if (charm.defenceAdd) over.defence = (over.defence ?? stock.defence ?? 0) + charm.defenceAdd;

  const radar = gear.radar && RADARS[gear.radar.def];
  let validAngleAdd = 0;
  if (radar) {
    const m = radarUpgradeMul(gear.radar!.upgrade);
    const mod = modSums(gear.radar);
    over.radarStdM = radar.radarStdM * m * pct(mod.stdRangePct);
    over.radarAdvM = radar.radarAdvM * m * pct(mod.advRangePct);
    over.radarRangeM = radar.radarRangeM * m;
    validAngleAdd += (radar.validAngleAdd ?? 0) + (mod.validAngleAdd ?? 0);
  }

  const weapon = (slot: 'primary' | 'secondary'): WeaponDef => {
    const item = gear[slot];
    const def = (item && WEAPONS[item.def]) || WEAPONS[stock[slot]]!;
    if (item && WEAPONS[item.def]) over[slot] = def.id;
    const mod = modSums(item);
    const charmPct = slot === 'primary' ? charm.primaryDamagePct : charm.secondaryDamagePct;
    const angle = slot === 'secondary' ? validAngleAdd + (mod.validAngleAdd ?? 0) : 0;
    const ammo = slot === 'primary' ? 'ammo1Max' : 'ammo2Max';
    if (mod.ammoPct) over[ammo] = Math.round(stock[ammo] * pct(mod.ammoPct));
    const changed = item || charmPct || angle || Object.keys(mod).length;
    if (!changed) return def;
    const out: WeaponDef = {
      ...def,
      damage: def.damage * upgradeMul(item?.upgrade ?? 0) * pct(mod.damagePct) * pct(charmPct),
      fireIntervalSec: def.fireIntervalSec / pct(mod.fireRatePct),
      speed: def.speed * pct(mod.projectileSpeedPct),
      accuracy: slot === 'primary' ? def.accuracy + (mod.accuracyAdd ?? 0) : def.accuracy,
    };
    if (angle && def.validAngleDeg > 0) {
      out.validAngleDeg = def.validAngleDeg + angle;
      out.lockConeRad = out.validAngleDeg * DEG;
    }
    return out;
  };

  if (gear.hotbar) over.hotbar = sanitizeHotbar(frame, gear.hotbar);
  return {
    over,
    weapons: [weapon('primary'), weapon('secondary')],
    tier,
    upgrade,
    cosmetic: gear.cosmetic?.def ?? '',
  };
}
