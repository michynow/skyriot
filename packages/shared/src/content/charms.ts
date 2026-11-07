import type { CharmDef, CharmEffect } from '../types';

// Charms: timed Pilot-wide buffs. Six effects × 1 h / 5 h / 24 h of logged-in time.
// Reward Charms +10 / +25 / +50 %; combat Charms kept small on purpose (fairness pillar): +3 / +5 / +5 %.
const LINES: { id: string; name: string; effect: (step: number) => CharmEffect }[] = [
  { id: 'mentors-coin', name: "Mentor's Coin", effect: (s) => ({ xpPct: REWARD[s] }) },
  { id: 'ledger-charm', name: 'Ledger Charm', effect: (s) => ({ creditsPct: REWARD[s] }) },
  { id: 'magpie-charm', name: 'Magpie Charm', effect: (s) => ({ scrapPct: REWARD[s] }) },
  { id: 'laurel-charm', name: 'Laurel Charm', effect: (s) => ({ gloryPct: REWARD[s] }) },
  {
    id: 'grudge-charm',
    name: 'Grudge Charm',
    effect: (s) => ({ primaryDamagePct: COMBAT[s], secondaryDamagePct: COMBAT[s] }),
  },
  { id: 'ward-charm', name: 'Ward Charm', effect: (s) => ({ defenceAdd: COMBAT[s]! / 100 }) },
];
const HOURS = [1, 5, 24];
const REWARD = [10, 25, 50];
const COMBAT = [3, 5, 5];

/** Reward Charms (XP / Credits / Scrap / Glory); the 1 h ones are sold for Credits. */
export const REWARD_CHARM_LINES = ['mentors-coin', 'ledger-charm', 'magpie-charm', 'laurel-charm'];

export const CHARMS: Record<string, CharmDef> = {};
export const CHARM_NAMES: Record<string, string> = {};
/** Charm line id (shared icon) per Charm id, e.g. 'ledger-charm-5h' → 'ledger-charm'. */
export const CHARM_LINE: Record<string, string> = {};

for (const line of LINES)
  HOURS.forEach((hours, step) => {
    const id = `${line.id}-${hours}h`;
    CHARMS[id] = { id, hours, effect: line.effect(step) };
    CHARM_NAMES[id] = `${line.name} (${hours} h)`;
    CHARM_LINE[id] = line.id;
  });
