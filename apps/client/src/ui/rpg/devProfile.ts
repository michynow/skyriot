import type { ItemInstance, PilotProfile } from '@skyriot/shared';

// DEV-only fixture so the RPG windows can be built and screenshotted without a server profile
// (`?devprofile` forces it over the live one). Never shipped: callers gate on import.meta.env.DEV.
let n = 0;
const it = (
  def: string,
  kind: ItemInstance['kind'],
  extra: Partial<ItemInstance> = {},
): ItemInstance => ({
  id: `dev-${++n}`,
  def,
  kind,
  upgrade: 0,
  ...extra,
});

const items: ItemInstance[] = [
  it('needle-cannon', 'weapon', { upgrade: 2 }),
  it('lancet-cannon', 'weapon', {
    upgrade: 6,
    rarity: 'prototype',
    mods: [
      'weapon-damagePct',
      'weapon-fireRatePct',
      ['weapon-accuracyAdd', 'weapon-ammoPct', 'weapon-projectileSpeedPct'],
    ],
  }),
  it('sting-missile', 'weapon', { upgrade: 6 }),
  it('hornet-missile', 'weapon', {
    upgrade: 3,
    rarity: 'custom',
    mods: [
      'weapon-projectileSpeedPct',
      ['weapon-damagePct', 'weapon-validAngleAdd', 'weapon-ammoPct'],
    ],
  }),
  it('kestrel-jet', 'engine'),
  it('falcon-jet', 'engine', { upgrade: 5, rarity: 'tuned', mods: ['engine-maxSpeedPct'] }),
  it('scale-plating', 'armor'),
  it('lamellar-plating', 'armor', {
    upgrade: 4,
    rarity: 'relic',
    mods: ['armor-hpPct', 'armor-shieldPct', 'armor-defenceAdd'],
  }),
  it('picket-radar', 'radar', { upgrade: 2 }),
  it('sentry-radar', 'radar'),
  it('ledger-charm-5h', 'charm', { msLeft: 4 * 3600e3 + 12 * 60e3 }),
  it('mentors-coin-24h', 'charm', { msLeft: 23 * 3600e3 + 5 * 60e3 }),
  it('grudge-charm-1h', 'charm'),
  it('gilded-ace', 'cosmetic'),
  it('desert-camo', 'cosmetic'),
  it('repair-kit', 'consumable', { count: 17 }),
  it('shield-kit', 'consumable', { count: 20 }),
  it('fuel-cell', 'consumable', { count: 8 }),
  it('flak-repeater', 'weapon', {
    rarity: 'tuned',
    mods: [['weapon-damagePct', 'weapon-fireRatePct', 'weapon-ammoPct']],
  }),
  it('bolted-slab', 'armor'),
].map((i, bag) => ({ ...i, bag }));

const id = (def: string) => items.find((i) => i.def === def)!.id;

export const DEV_PROFILE: PilotProfile = {
  name: 'Vale Orsini',
  nation: 'concord',
  level: 34,
  xp: 48210,
  wallet: { credits: 18420, scrap: 312, glory: 1075 },
  items: items.map((i) =>
    // equipped items have no Bag cell
    [
      'lancet-cannon',
      'hornet-missile',
      'falcon-jet',
      'lamellar-plating',
      'picket-radar',
      'gilded-ace',
      'ledger-charm-5h',
      'mentors-coin-24h',
    ].includes(i.def)
      ? { ...i, bag: null }
      : i,
  ),
  loadouts: {
    wasp: {
      primary: id('lancet-cannon'),
      secondary: id('hornet-missile'),
      engine: id('falcon-jet'),
      armor: id('lamellar-plating'),
      radar: id('picket-radar'),
      cosmetic: id('gilded-ace'),
    },
  },
  charms: [id('ledger-charm-5h'), id('mentors-coin-24h'), null],
  guest: false,
};
