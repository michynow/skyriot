import type {
  EquipSlot,
  FrameId,
  GearSlot,
  ItemDefId,
  ItemId,
  ItemInstance,
  PilotProfile,
  ShopEntry,
  SkillId,
  Wallet,
} from '../types';
import { ARMORS, ARMOR_FRAME } from './armors';
import { CHARMS } from './charms';
import { COSMETICS } from './cosmetics';
import { ENGINES, ENGINE_FRAME } from './engines';
import { FRAMES } from './frames';
import { ITEMS } from './items';
import { RADARS, RADAR_FRAME } from './radars';
import { WEAPONS } from './weapons';

export const MAX_UPGRADE = 10;

/** Fresh Pilot wallet (guests and new accounts). */
export const STARTING_WALLET: Wallet = { credits: 2500, scrap: 60, glory: 0 };

/** Paid to the killer for downing an enemy Ship. */
export const KILL_REWARD = { credits: 60, scrap: 4 };

/** Shop catalogue: every ITEMS entry with a Credits price. Cities sell every unlocked tier. */
export const SHOP: ShopEntry[] = Object.values(ITEMS)
  .filter((d) => d.credits > 0)
  .map((d) => ({ def: d.id, kind: d.kind, tier: d.tier, credits: d.credits }));

/** Bag cells (8 × 6). */
export const BAG_SIZE = 48;
/** Pilot Level that unlocks Charm slot I, II, III. */
export const CHARM_SLOT_LEVELS = [1, 30, 60];
/** Selling pays this fraction of the Credits price (Upgrades not refunded). */
export const SELL_RATE = 0.25;
/** What a new Pilot (and every guest) starts with, per Consumable. */
export const STARTING_CONSUMABLES: Record<SkillId, number> = {
  'repair-kit': 5,
  'shield-kit': 5,
  'fuel-cell': 5,
};

/** Deterministic upgrade cost (ADR 0004): never fails, never breaks. `level` = the + being bought (1..10). */
export function upgradeCost(tier: number, level: number): { credits: number; scrap: number } {
  return { credits: Math.round(100 * tier * level ** 1.5), scrap: Math.round(5 * tier * level) };
}

/** Stat multiplier an upgraded item applies (damage for weapons, speeds for engines). */
export function upgradeMul(upgrade: number): number {
  return 1 + 0.03 * upgrade;
}

export function itemTier(def: ItemDefId): number {
  return ITEMS[def]?.tier ?? 1;
}

/**
 * Can `def` go in `slot` of `frame`? Engines, armor and radars fit their own Frame's line; weapons fit a slot whose
 * stock weapon fires the same projectile kind (any gun as Primary, missile for missile, and so on); Cosmetics fit
 * any Frame; Charm slots take any Charm.
 */
export function fitsSlot(frame: FrameId, slot: EquipSlot, def: ItemDefId): boolean {
  switch (slot) {
    case 'engine':
      return !!ENGINES[def] && ENGINE_FRAME[def] === frame;
    case 'armor':
      return !!ARMORS[def] && ARMOR_FRAME[def] === frame;
    case 'radar':
      return !!RADARS[def] && RADAR_FRAME[def] === frame;
    case 'cosmetic':
      return !!COSMETICS[def];
    case 'charm0':
    case 'charm1':
    case 'charm2':
      return !!CHARMS[def];
    default: {
      const w = WEAPONS[def];
      return !!w && w.kind === WEAPONS[FRAMES[frame][slot]]?.kind;
    }
  }
}

export const GEAR_SLOTS: GearSlot[] = [
  'primary',
  'secondary',
  'engine',
  'armor',
  'radar',
  'cosmetic',
];

/** Equipped items for a Frame (what the sim resolves). Absent slot = stock part; `hotbar` absent = FrameDef.hotbar. */
export type ShipGear = Partial<Record<GearSlot, ItemInstance>> & {
  /** The Pilot's equipped Charms (activated or not), Pilot-wide. */
  charms?: ItemInstance[];
  /** The Pilot's own hotbar layout for this Frame. */
  hotbar?: (SkillId | null)[];
};

/** A Pilot's gear for `frame`: server and client prediction both build it from the same profile. */
export function gearOf(profile: PilotProfile, frame: FrameId): ShipGear {
  const gear: ShipGear = {};
  const loadout = profile.loadouts[frame] ?? {};
  const byId = (id: ItemId | null | undefined) => profile.items.find((i) => i.id === id);
  for (const slot of GEAR_SLOTS) {
    const item = byId(loadout[slot]);
    if (item && fitsSlot(frame, slot, item.def)) gear[slot] = item;
  }
  const charms = (profile.charms ?? []).map(byId).filter((i) => !!i && !!CHARMS[i.def]);
  if (charms.length) gear.charms = charms as ItemInstance[];
  if (loadout.hotbar) gear.hotbar = loadout.hotbar;
  return gear;
}

/** Ids of every equipped item (any Frame's Loadout or a Charm slot): these have no Bag cell. */
export function equippedIds(profile: PilotProfile): Set<ItemId> {
  const ids = new Set<ItemId>();
  for (const l of Object.values(profile.loadouts))
    for (const slot of GEAR_SLOTS) if (l?.[slot]) ids.add(l[slot]!);
  for (const c of profile.charms ?? []) if (c) ids.add(c);
  return ids;
}

/** First empty Bag cell, or null when the Bag is full. */
export function freeBagCell(profile: PilotProfile): number | null {
  const used = new Set(profile.items.map((i) => i.bag));
  for (let c = 0; c < BAG_SIZE; c++) if (!used.has(c)) return c;
  return null;
}
