import { randomUUID } from 'node:crypto';
import {
  FRAMES,
  KILL_REWARD,
  MAX_UPGRADE,
  SHOP,
  STARTING_WALLET,
  fitsSlot,
  itemTier,
  upgradeCost,
  type FrameId,
  type Loadout,
  type MapDef,
  type NationId,
  type PilotProfile,
} from '@skyriot/shared';

// Server-side economy: every handler validates the raw client message and mutates the profile in place.
// Each returns an error line for the Pilot, or null when the profile changed (caller resends it).

const SLOTS: (keyof Loadout)[] = ['primary', 'secondary', 'engine'];

/** ponytail: in-memory guest profile, lost on leave; persistence replaces this with a DB load. */
export function loadProfile(name: string, nation: NationId): PilotProfile {
  return {
    name,
    nation,
    level: 1,
    xp: 0,
    wallet: { ...STARTING_WALLET },
    items: [],
    loadouts: {},
    guest: true,
  };
}

/** Shop, upgrades and equip only work in a city (any map while developing, until cities exist). */
export function canTrade(map: MapDef): boolean {
  return map.city !== undefined || process.env.NODE_ENV === 'development';
}

const field = (raw: unknown, key: string): unknown =>
  typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)[key] : undefined;

export function buy(profile: PilotProfile, raw: unknown): string | null {
  const entry = SHOP.find((e) => e.def === field(raw, 'def'));
  if (!entry) return 'unknown item';
  if (profile.wallet.credits < entry.credits) return 'not enough credits';
  profile.wallet.credits -= entry.credits;
  profile.items.push({ id: randomUUID(), def: entry.def, kind: entry.kind, upgrade: 0 });
  return null;
}

/** Deterministic (ADR 0004): pay the cost, get the +1. Never fails once paid. */
export function upgrade(profile: PilotProfile, raw: unknown): string | null {
  const item = profile.items.find((i) => i.id === field(raw, 'item'));
  if (!item) return 'unknown item';
  if (item.upgrade >= MAX_UPGRADE) return `already +${MAX_UPGRADE}`;
  const cost = upgradeCost(itemTier(item.def), item.upgrade + 1);
  const w = profile.wallet;
  if (w.credits < cost.credits || w.scrap < cost.scrap) return 'not enough credits or scrap';
  w.credits -= cost.credits;
  w.scrap -= cost.scrap;
  item.upgrade++;
  return null;
}

export function equip(profile: PilotProfile, raw: unknown): string | null {
  const frame = field(raw, 'frame') as FrameId;
  const slot = field(raw, 'slot') as keyof Loadout;
  const itemId = field(raw, 'item');
  if (!(frame in FRAMES) || !SLOTS.includes(slot)) return 'bad equip request';
  const loadout = (profile.loadouts[frame] ??= {});
  if (itemId === null) {
    delete loadout[slot];
    return null;
  }
  const item = profile.items.find((i) => i.id === itemId);
  if (!item) return 'unknown item';
  if (!fitsSlot(frame, slot, item.def)) return `doesn't fit the ${FRAMES[frame].name} ${slot}`;
  // One item, one slot: move it off any other Frame/slot first.
  for (const l of Object.values(profile.loadouts))
    for (const s of SLOTS) if (l?.[s] === item.id) delete l[s];
  loadout[slot] = item.id;
  return null;
}

export function awardKill(profile: PilotProfile): void {
  profile.wallet.credits += KILL_REWARD.credits;
  profile.wallet.scrap += KILL_REWARD.scrap;
}
