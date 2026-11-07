import { create } from 'zustand';
import {
  BAG_SIZE,
  CHARM_SLOT_LEVELS,
  CHARMS,
  SELL_RATE,
  ITEMS,
  gearOf,
  type EquipSlot,
  type FrameId,
  type ItemInstance,
  type PilotProfile,
} from '@skyriot/shared';
import { useHud } from '../../hud/hudStore';
import { session } from '../../net/session';
import { useProfile } from '../../state/profile';
import { world } from '../../state/world';
import { DEV_PROFILE } from './devProfile';
import { slotFor } from './statSheet';

export const FRAME_TABS: FrameId[] = ['wasp', 'anvil', 'halo', 'bulwark'];

const forceFixture = () => import.meta.env.DEV && location.search.includes('devprofile');

/** The Pilot profile the windows draw: the live one, or the DEV fixture (no profile yet, or `?devprofile`). */
export function useRpgProfile(): PilotProfile | null {
  const live = useProfile((s) => s.profile);
  if (import.meta.env.DEV && (forceFixture() || !live)) return DEV_PROFILE;
  return live;
}

/** Frame shown in the Character window (its tabs); Inventory right-click equips to it. null = the flown Frame. */
export const useEditFrame = create<{ frame: FrameId | null }>(() => ({ frame: null }));

export function useShownFrame(): FrameId {
  const edit = useEditFrame((s) => s.frame);
  const flown = useHud((h) => h.frame);
  return edit ?? flown ?? 'wasp';
}

/** Cities trade and swap freely; in flight combat gear is view-only (the server enforces it; dev maps allow it). */
export const inCity = (): boolean => !!world.map?.city || import.meta.env.DEV;

export const unlockedCharmSlots = (level: number): number =>
  CHARM_SLOT_LEVELS.filter((l) => level >= l).length;

export const sellPrice = (i: Pick<ItemInstance, 'def' | 'count'>): number =>
  Math.floor((ITEMS[i.def]?.credits ?? 0) * SELL_RATE) * (i.count ?? 1);

/** Where equipping `item` on `frame` goes: its gear slot, or the first free (else first) unlocked Charm slot. */
export function targetSlot(p: PilotProfile, frame: FrameId, item: ItemInstance): EquipSlot | null {
  const s = slotFor(frame, item.def);
  if (!s) return null;
  if (s !== 'charm') return s;
  const open = unlockedCharmSlots(p.level);
  const idx = p.charms.findIndex((c, i) => i < open && !c);
  const pick = idx >= 0 ? idx : 0;
  return open ? (`charm${pick}` as EquipSlot) : null;
}

export function equip(frame: FrameId, slot: EquipSlot, item: string | null) {
  session.conn?.equip({ frame, slot, item });
}

export function equippedOn(p: PilotProfile, frame: FrameId) {
  return gearOf(p, frame);
}

export { BAG_SIZE, CHARMS };
