import { itemTier, upgradeMul, type ShipGear } from '../content/economy';
import { ENGINES } from '../content/engines';
import { FRAMES } from '../content/frames';
import { WEAPONS } from '../content/weapons';
import type { FrameDef, FrameId, WeaponDef } from '../types';

/** A Ship's equipped gear, resolved once when it changes (never per tick). */
export interface ResolvedGear {
  /** FrameDef fields the gear overrides (engine stats, weapon ids), laid over the tuned Frame each tick. */
  over: Partial<FrameDef>;
  /** Primary, Secondary with upgrade damage applied. */
  weapons: [WeaponDef, WeaponDef];
  /** Visual tier / upgrade: the best equipped item. */
  tier: number;
  upgrade: number;
}

export function resolveGear(frame: FrameId, gear: ShipGear): ResolvedGear {
  const stock = FRAMES[frame];
  const over: Partial<FrameDef> = {};
  let tier = 1;
  let upgrade = 0;
  for (const item of [gear.primary, gear.secondary, gear.engine]) {
    if (!item) continue;
    tier = Math.max(tier, itemTier(item.def));
    upgrade = Math.max(upgrade, item.upgrade);
  }
  const engine = gear.engine && ENGINES[gear.engine.def];
  if (engine) {
    const m = upgradeMul(gear.engine!.upgrade);
    const { id, name: _name, ...stats } = engine;
    Object.assign(over, stats, {
      engine: id,
      minSpeed: stats.minSpeed * m,
      cruiseSpeed: stats.cruiseSpeed * m,
      maxSpeed: stats.maxSpeed * m,
      boostSpeed: stats.boostSpeed * m,
    });
  }
  const weapon = (slot: 'primary' | 'secondary'): WeaponDef => {
    const item = gear[slot];
    const def = item && WEAPONS[item.def];
    if (!item || !def) return WEAPONS[stock[slot]]!;
    over[slot] = def.id;
    return { ...def, damage: def.damage * upgradeMul(item.upgrade) };
  };
  return { over, weapons: [weapon('primary'), weapon('secondary')], tier, upgrade };
}
