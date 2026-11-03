import type {
  FrameId,
  ItemDefId,
  ItemInstance,
  Loadout,
  PilotProfile,
  ShopEntry,
  Wallet,
} from '../types';
import { ENGINES, ENGINE_FRAME } from './engines';
import { FRAMES } from './frames';
import { WEAPONS } from './weapons';

export const MAX_UPGRADE = 10;

/** Fresh Pilot wallet (guests and new accounts). */
export const STARTING_WALLET: Wallet = { credits: 2500, scrap: 60, glory: 0 };

/** Paid to the killer for downing an enemy Ship. */
export const KILL_REWARD = { credits: 60, scrap: 4 };

// Tier 1 = the stock parts (cheap, so they can be owned and upgraded); tiers 2–3 are better lines.
const T1 = 300;
const T2 = 1500;
const T3 = 4000;
const ENGINE_PRICE_MUL = 1.2;

const weapon = (def: string, tier: number, credits: number): ShopEntry => ({
  def,
  kind: 'weapon',
  tier,
  credits,
});
const engine = (def: string, tier: number, credits: number): ShopEntry => ({
  def,
  kind: 'engine',
  tier,
  credits: Math.round(credits * ENGINE_PRICE_MUL),
});

/** Shop catalogue; sessions add entries here. */
export const SHOP: ShopEntry[] = [
  // Primaries
  weapon('needle-cannon', 1, T1),
  weapon('quill-repeater', 2, T2),
  weapon('lancet-cannon', 3, T3),
  weapon('flak-repeater', 1, T1),
  weapon('burst-flak', 2, T2),
  weapon('thunder-flak', 3, T3),
  weapon('pulse-blaster', 1, T1),
  weapon('arc-blaster', 2, T2),
  weapon('prism-blaster', 3, T3),
  weapon('twin-autocannon', 1, T1),
  weapon('twin-hammer', 2, T2),
  weapon('quad-autocannon', 3, T3),
  // Secondaries
  weapon('sting-missile', 1, T1),
  weapon('hornet-missile', 2, T2),
  weapon('talon-missile', 3, T3),
  weapon('seeker-pod', 1, T1),
  weapon('hound-pod', 2, T2),
  weapon('warden-pod', 3, T3),
  weapon('brick-bomb', 1, T1),
  weapon('slab-bomb', 2, T2),
  weapon('monolith-bomb', 3, T3),
  weapon('mortar-battery', 1, T1),
  weapon('howler-battery', 2, T2),
  weapon('quake-battery', 3, T3),
  // Engines
  engine('kestrel-jet', 1, T1),
  engine('falcon-jet', 2, T2),
  engine('gyre-jet', 3, T3),
  engine('mule-turbine', 1, T1),
  engine('ox-turbine', 2, T2),
  engine('bison-turbine', 3, T3),
  engine('lantern-drive', 1, T1),
  engine('beacon-drive', 2, T2),
  engine('pharos-drive', 3, T3),
  engine('crawler-rig', 1, T1),
  engine('tread-rig', 2, T2),
  engine('titan-rig', 3, T3),
];

/** Deterministic upgrade cost (ADR 0004): never fails, never breaks. `level` = the + being bought (1..10). */
export function upgradeCost(tier: number, level: number): { credits: number; scrap: number } {
  return { credits: Math.round(100 * tier * level ** 1.5), scrap: Math.round(5 * tier * level) };
}

/** Stat multiplier an upgraded item applies (damage for weapons, speeds for engines). */
export function upgradeMul(upgrade: number): number {
  return 1 + 0.03 * upgrade;
}

export function itemTier(def: ItemDefId): number {
  return SHOP.find((e) => e.def === def)?.tier ?? 1;
}

/**
 * Can `def` go in `slot` of `frame`? Engines fit their own Frame's line; weapons fit a slot whose
 * stock weapon fires the same projectile kind (any gun as Primary, missile for missile, and so on).
 */
export function fitsSlot(frame: FrameId, slot: keyof Loadout, def: ItemDefId): boolean {
  if (slot === 'engine') return !!ENGINES[def] && ENGINE_FRAME[def] === frame;
  const w = WEAPONS[def];
  return !!w && w.kind === WEAPONS[FRAMES[frame][slot]]?.kind;
}

/** Equipped items per slot for a Frame (what the sim resolves). Absent = stock part. */
export type ShipGear = Partial<Record<keyof Loadout, ItemInstance>>;

/** A Pilot's gear for `frame`: server and client prediction both build it from the same profile. */
export function gearOf(profile: PilotProfile, frame: FrameId): ShipGear {
  const gear: ShipGear = {};
  const loadout = profile.loadouts[frame] ?? {};
  for (const slot of ['primary', 'secondary', 'engine'] as const) {
    const item = profile.items.find((i) => i.id === loadout[slot]);
    if (item && fitsSlot(frame, slot, item.def)) gear[slot] = item;
  }
  return gear;
}
