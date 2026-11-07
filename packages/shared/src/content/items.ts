import type { ItemDef, ItemDefId, ItemKind } from '../types';
import { ARMOR_FRAME, ARMOR_NAMES, ARMOR_TIER } from './armors';
import { CHARMS, CHARM_LINE, CHARM_NAMES, REWARD_CHARM_LINES } from './charms';
import { COSMETICS, COSMETIC_NAMES, COSMETIC_PRICE } from './cosmetics';
import { ENGINES, ENGINE_FRAME } from './engines';
import { RADAR_FRAME, RADAR_NAMES, RADAR_TIER } from './radars';
import { SKILLS, WEAPONS } from './weapons';

// Every ownable def. Tiers 1–3 are Chapter 1, so no Level gate yet (levelReq 1).
// Tier 1 = the stock parts (cheap, so they can be owned and upgraded); tiers 2–3 are better lines.
const PRICE = [300, 1500, 4000];
const ENGINE_PRICE_MUL = 1.2;
const ARMOR_PRICE_MUL = 1.2;
/** Max per bag cell for Consumables. */
export const CONSUMABLE_STACK = 20;
const CONSUMABLE_PRICE: Record<string, number> = {
  'repair-kit': 40,
  'shield-kit': 40,
  'fuel-cell': 30,
};
const REWARD_CHARM_1H_PRICE = 400;

// Weapon lines: [T1, T2, T3]; T1 is a Frame's stock weapon.
const WEAPON_LINES = [
  ['needle-cannon', 'quill-repeater', 'lancet-cannon'],
  ['flak-repeater', 'burst-flak', 'thunder-flak'],
  ['pulse-blaster', 'arc-blaster', 'prism-blaster'],
  ['twin-autocannon', 'twin-hammer', 'quad-autocannon'],
  ['sting-missile', 'hornet-missile', 'talon-missile'],
  ['seeker-pod', 'hound-pod', 'warden-pod'],
  ['brick-bomb', 'slab-bomb', 'monolith-bomb'],
  ['mortar-battery', 'howler-battery', 'quake-battery'],
];
const ENGINE_LINES = [
  ['kestrel-jet', 'falcon-jet', 'gyre-jet'],
  ['mule-turbine', 'ox-turbine', 'bison-turbine'],
  ['lantern-drive', 'beacon-drive', 'pharos-drive'],
  ['crawler-rig', 'tread-rig', 'titan-rig'],
];

const def = (
  id: string,
  kind: ItemKind,
  name: string,
  tier: number,
  credits: number,
  extra: Partial<ItemDef> = {},
): ItemDef => ({ id, kind, name, tier, levelReq: 1, credits, stack: 1, ...extra });

export const ITEMS: Record<ItemDefId, ItemDef> = {};
const add = (d: ItemDef) => (ITEMS[d.id] = d);

// Icons: variants of one line share a glyph (the T1 id) and differ by tier trim.
for (const line of WEAPON_LINES)
  line.forEach((id, i) =>
    add(def(id, 'weapon', WEAPONS[id]!.name, i + 1, PRICE[i]!, { icon: line[0] })),
  );
for (const line of ENGINE_LINES)
  line.forEach((id, i) =>
    add(
      def(id, 'engine', ENGINES[id]!.name, i + 1, Math.round(PRICE[i]! * ENGINE_PRICE_MUL), {
        frame: ENGINE_FRAME[id],
        icon: line[0],
      }),
    ),
  );
for (const [id, frame] of Object.entries(ARMOR_FRAME)) {
  const tier = ARMOR_TIER[id]!;
  add(
    def(id, 'armor', ARMOR_NAMES[id]!, tier, Math.round(PRICE[tier - 1]! * ARMOR_PRICE_MUL), {
      frame,
      icon: `armor-${frame}`,
    }),
  );
}
for (const [id, frame] of Object.entries(RADAR_FRAME)) {
  const tier = RADAR_TIER[id]!;
  add(
    def(id, 'radar', RADAR_NAMES[id]!, tier, PRICE[tier - 1]!, { frame, icon: `radar-${frame}` }),
  );
}
for (const [id, c] of Object.entries(CHARMS)) {
  const line = CHARM_LINE[id]!;
  const sold = c.hours === 1 && REWARD_CHARM_LINES.includes(line);
  add(def(id, 'charm', CHARM_NAMES[id]!, 1, sold ? REWARD_CHARM_1H_PRICE : 0, { icon: line }));
}
for (const id of Object.keys(COSMETICS))
  add(def(id, 'cosmetic', COSMETIC_NAMES[id]!, 1, COSMETIC_PRICE[id]!));
for (const [id, credits] of Object.entries(CONSUMABLE_PRICE))
  add(def(id, 'consumable', SKILLS[id]!.name, 1, credits, { stack: CONSUMABLE_STACK }));
