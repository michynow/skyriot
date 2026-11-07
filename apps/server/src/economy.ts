import { randomUUID } from 'node:crypto';
import {
  BAG_SIZE,
  CHARMS,
  CHARM_SLOT_LEVELS,
  FRAMES,
  GEAR_SLOTS,
  ITEMS,
  KILL_REWARD,
  MAX_UPGRADE,
  SELL_RATE,
  SKILLS,
  fitsSlot,
  freeBagCell,
  itemTier,
  sanitizeHotbar,
  upgradeCost,
  type CharmEffect,
  type EquipSlot,
  type FrameId,
  type GearSlot,
  type ItemInstance,
  type MapDef,
  type PilotProfile,
  type Rarity,
  type SkillId,
} from '@skyriot/shared';
import { charmEffect } from './charms';

// Server-side economy: every handler validates the raw client message and mutates the profile in place.
// Each returns an error line for the Pilot, or null when the profile changed (caller resends it).

/** Where the Pilot stands when a request arrives. */
export interface Place {
  city: boolean;
  /** On a Launch Deck (combat gear swaps here too). */
  docked: boolean;
}

/** Vendor (buy, sell, upgrade) only works in a City (any map while developing). */
export function canTrade(map: MapDef): boolean {
  return map.city !== undefined || process.env.NODE_ENV === 'development';
}

const field = (raw: unknown, key: string): unknown =>
  typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)[key] : undefined;
const findItem = (profile: PilotProfile, id: unknown) => profile.items.find((i) => i.id === id);
const CHARM_SLOTS = ['charm0', 'charm1', 'charm2'] as const;
/** Gear that changes combat numbers: City or Docked only. */
const COMBAT_SLOTS: readonly EquipSlot[] = ['primary', 'secondary', 'engine', 'armor', 'radar'];

const isEquipped = (profile: PilotProfile, id: string) =>
  profile.charms.includes(id) ||
  Object.values(profile.loadouts).some((l) => GEAR_SLOTS.some((s) => l?.[s] === id));

/** Put an item into the Bag: stack onto a same-def Consumable stack first, else a free cell. */
function addToBag(profile: PilotProfile, item: ItemInstance): boolean {
  const def = ITEMS[item.def];
  let left = item.count ?? 1;
  if (def && def.stack > 1)
    for (const s of profile.items) {
      if (left === 0) break;
      if (s.def !== item.def || s.bag == null) continue;
      const room = def.stack - (s.count ?? 1);
      const n = Math.min(room, left);
      if (n > 0) {
        s.count = (s.count ?? 1) + n;
        left -= n;
      }
    }
  if (left === 0) return true;
  const cell = freeBagCell(profile);
  if (cell === null) return false;
  item.count = left;
  if (left === 1) delete item.count;
  item.bag = cell;
  profile.items.push(item);
  return true;
}

/** Room for `count` of `def`? (stacks first, then free cells) */
function bagRoom(profile: PilotProfile, def: string, count: number): boolean {
  const stack = ITEMS[def]?.stack ?? 1;
  let room = 0;
  for (const s of profile.items)
    if (s.def === def && s.bag != null) room += Math.max(0, stack - (s.count ?? 1));
  const used = new Set(profile.items.map((i) => i.bag).filter((b) => b != null));
  room += (BAG_SIZE - used.size) * stack;
  return room >= count;
}

/** Dev / rewards: a new item into the Bag. Returns false when the Bag is full. */
export function giveItem(
  profile: PilotProfile,
  def: string,
  opts: { rarity?: Rarity; upgrade?: number; count?: number } = {},
): boolean {
  const d = ITEMS[def];
  if (!d) return false;
  const count = Math.max(1, Math.min(opts.count ?? 1, d.stack * BAG_SIZE));
  if (!bagRoom(profile, def, count)) return false;
  // Non-stacking defs: one instance per item.
  const n = d.stack > 1 ? 1 : count;
  for (let k = 0; k < n; k++) {
    const item: ItemInstance = { id: randomUUID(), def, kind: d.kind, upgrade: 0 };
    if (d.kind !== 'consumable' && d.kind !== 'charm' && d.kind !== 'cosmetic')
      item.upgrade = Math.max(0, Math.min(opts.upgrade ?? 0, MAX_UPGRADE));
    if (opts.rarity && opts.rarity !== 'standard') item.rarity = opts.rarity;
    if (d.stack > 1) item.count = count;
    if (!addToBag(profile, item)) return false;
  }
  return true;
}

export function buy(profile: PilotProfile, raw: unknown): string | null {
  const def = ITEMS[field(raw, 'def') as string];
  if (!def || def.credits <= 0) return 'unknown item';
  if (profile.level < def.levelReq) return `needs Level ${def.levelReq}`;
  if (profile.wallet.credits < def.credits) return 'not enough credits';
  if (!giveItem(profile, def.id)) return 'bag full';
  profile.wallet.credits -= def.credits;
  return null;
}

/** Sell (`pay` = true) or discard: the whole stack unless `count` says fewer. Equipped items can't go. */
function remove(profile: PilotProfile, raw: unknown, pay: boolean): string | null {
  const item = findItem(profile, field(raw, 'item'));
  if (!item) return 'unknown item';
  if (isEquipped(profile, item.id)) return 'unequip it first';
  const have = item.count ?? 1;
  const want = field(raw, 'count');
  const n = Number.isInteger(want) && (want as number) > 0 ? Math.min(want as number, have) : have;
  if (pay) profile.wallet.credits += Math.floor((ITEMS[item.def]?.credits ?? 0) * SELL_RATE) * n;
  if (n < have) {
    item.count = have - n;
    if (item.count === 1) delete item.count;
  } else profile.items.splice(profile.items.indexOf(item), 1);
  return null;
}
export const sell = (profile: PilotProfile, raw: unknown) => remove(profile, raw, true);
export const discard = (profile: PilotProfile, raw: unknown) => remove(profile, raw, false);

/** Move a Bag item to a cell; swaps with whatever is there. */
export function moveItem(profile: PilotProfile, raw: unknown): string | null {
  const item = findItem(profile, field(raw, 'item'));
  const cell = field(raw, 'bag');
  if (!item || item.bag == null) return 'unknown item';
  if (!Number.isInteger(cell) || (cell as number) < 0 || (cell as number) >= BAG_SIZE)
    return 'bad bag cell';
  const other = profile.items.find((i) => i.bag === cell);
  if (other) other.bag = item.bag;
  item.bag = cell as number;
  return null;
}

/** Deterministic (ADR 0004): pay the cost, get the +1. Never fails once paid. */
export function upgrade(profile: PilotProfile, raw: unknown): string | null {
  const item = findItem(profile, field(raw, 'item'));
  if (!item) return 'unknown item';
  if (!['weapon', 'engine', 'armor', 'radar'].includes(item.kind)) return 'not upgradable';
  if (item.upgrade >= MAX_UPGRADE) return `already +${MAX_UPGRADE}`;
  const cost = upgradeCost(itemTier(item.def), item.upgrade + 1);
  const w = profile.wallet;
  if (w.credits < cost.credits || w.scrap < cost.scrap) return 'not enough credits or scrap';
  w.credits -= cost.credits;
  w.scrap -= cost.scrap;
  item.upgrade++;
  return null;
}

/**
 * Equip any slot of any Frame, or a Charm slot. Combat gear needs a City or the Launch Deck; Cosmetic and Charms
 * change anywhere. The item comes out of the Bag; whatever it replaces goes into the cell it left.
 */
export function equip(profile: PilotProfile, raw: unknown, place: Place): string | null {
  const frame = field(raw, 'frame') as FrameId;
  const slot = field(raw, 'slot') as EquipSlot;
  const itemId = field(raw, 'item');
  const charmIdx = CHARM_SLOTS.indexOf(slot as (typeof CHARM_SLOTS)[number]);
  if (charmIdx < 0 && (!(frame in FRAMES) || !GEAR_SLOTS.includes(slot as GearSlot)))
    return 'bad equip request';
  if (COMBAT_SLOTS.includes(slot) && !place.city && !place.docked)
    return 'combat gear swaps only in a City or Docked on a Launch Deck';
  if (charmIdx >= 0 && profile.level < CHARM_SLOT_LEVELS[charmIdx]!)
    return `Charm slot ${charmIdx + 1} opens at Level ${CHARM_SLOT_LEVELS[charmIdx]}`;
  const loadout = charmIdx < 0 ? (profile.loadouts[frame] ??= {}) : null;
  const currentId = loadout ? loadout[slot as GearSlot] : profile.charms[charmIdx];
  const current = findItem(profile, currentId);
  const setSlot = (id: string | null) => {
    if (loadout) {
      if (id) loadout[slot as GearSlot] = id;
      else delete loadout[slot as GearSlot];
    } else profile.charms[charmIdx] = id;
  };
  if (itemId === null) {
    if (!current) {
      setSlot(null);
      return null;
    }
    const cell = freeBagCell(profile);
    if (cell === null) return 'bag full';
    setSlot(null);
    if (!isEquipped(profile, current.id)) current.bag = cell;
    return null;
  }
  const item = findItem(profile, itemId);
  if (!item) return 'unknown item';
  if (profile.level < (ITEMS[item.def]?.levelReq ?? 1)) return 'Level too low';
  if (!fitsSlot(frame, slot, item.def))
    return charmIdx >= 0 ? 'not a Charm' : `doesn't fit the ${FRAMES[frame].name} ${slot}`;
  if (item.id === currentId) return null;
  if (current && item.bag == null && freeBagCell(profile) === null) return 'bag full';
  // One item, one slot: take it off any other Frame/slot first.
  for (const l of Object.values(profile.loadouts))
    for (const s of GEAR_SLOTS) if (l?.[s] === item.id) delete l[s];
  profile.charms = profile.charms.map((c) => (c === item.id ? null : c));
  const cell = item.bag;
  delete item.bag;
  setSlot(item.id);
  // Charm activation: the timer starts the first time it is equipped.
  if (charmIdx >= 0 && item.msLeft === undefined)
    item.msLeft = (CHARMS[item.def]?.hours ?? 0) * 3_600_000;
  if (current && !isEquipped(profile, current.id)) current.bag = cell ?? freeBagCell(profile)!;
  return null;
}

/** The Pilot's own hotbar for a Frame: kit Skills and Consumables only, each once. Changes anywhere. */
export function setHotbar(profile: PilotProfile, raw: unknown): string | null {
  const frame = field(raw, 'frame') as FrameId;
  const slots = field(raw, 'slots');
  if (!(frame in FRAMES) || !Array.isArray(slots)) return 'bad hotbar request';
  (profile.loadouts[frame] ??= {}).hotbar = sanitizeHotbar(frame, slots as (SkillId | null)[]);
  return null;
}

/** Pick one of the three Mods offered on a Mod slot, once. */
export function chooseMod(profile: PilotProfile, raw: unknown): string | null {
  const item = findItem(profile, field(raw, 'item'));
  const slot = field(raw, 'slot');
  const mod = field(raw, 'mod');
  const offer = Number.isInteger(slot) ? item?.mods?.[slot as number] : undefined;
  if (!item || !Array.isArray(offer)) return 'no Mod to choose there';
  if (typeof mod !== 'string' || !offer.includes(mod)) return 'not one of the offered Mods';
  item.mods![slot as number] = mod;
  return null;
}

/** One Consumable spent (the skillUsed event): smallest stack first, an empty stack frees its cell. */
export function spendConsumable(profile: PilotProfile, skill: SkillId): boolean {
  if (SKILLS[skill]?.kind !== 'consumable') return false;
  const stacks = profile.items.filter((i) => i.def === skill);
  if (!stacks.length) return false;
  const s = stacks.reduce((a, b) => ((a.count ?? 1) <= (b.count ?? 1) ? a : b));
  const n = (s.count ?? 1) - 1;
  if (n <= 0) profile.items.splice(profile.items.indexOf(s), 1);
  else if (n === 1) delete s.count;
  else s.count = n;
  return true;
}

/** Kill reward, raised by the Pilot's reward Charms. */
export function awardKill(profile: PilotProfile): void {
  const e: CharmEffect = charmEffect(profile);
  profile.wallet.credits += Math.round(KILL_REWARD.credits * (1 + (e.creditsPct ?? 0) / 100));
  profile.wallet.scrap += Math.round(KILL_REWARD.scrap * (1 + (e.scrapPct ?? 0) / 100));
}
