import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  STARTING_CONSUMABLES,
  STARTING_WALLET,
  equippedIds,
  freeBagCell,
  type FrameId,
  type ItemId,
  type ItemInstance,
  type Loadout,
  type NationId,
  type PilotProfile,
  type Rarity,
} from '@skyriot/shared';
import { accountFromToken } from './auth';
import { db, schema } from './db';

const { pilot, item, loadout } = schema;
const pilotIds = new WeakMap<PilotProfile, string>();
const writes = new WeakMap<PilotProfile, Promise<void>>();

function guest(name: string, nation: NationId): PilotProfile {
  const profile: PilotProfile = {
    name,
    nation,
    level: 1,
    xp: 0,
    wallet: { ...STARTING_WALLET },
    items: [],
    loadouts: {},
    charms: [null, null, null],
    guest: true,
  };
  giveStartingConsumables(profile);
  return profile;
}

/** New Pilots (and every guest) start with STARTING_CONSUMABLES, one stack each. */
function giveStartingConsumables(profile: PilotProfile): void {
  for (const [def, count] of Object.entries(STARTING_CONSUMABLES))
    profile.items.push({ id: randomUUID(), def, kind: 'consumable', upgrade: 0, count });
  assignBags(profile);
}

/** Give every unequipped item without a Bag cell the first free one (rows from before the Bag, new items). */
function assignBags(profile: PilotProfile): void {
  const equipped = equippedIds(profile);
  for (const i of profile.items) {
    if (equipped.has(i.id)) delete i.bag;
    else if (i.bag == null) {
      const cell = freeBagCell(profile);
      if (cell === null) break; // ponytail: overflow stays bagless until the Salvage mail line exists
      i.bag = cell;
    }
  }
}

type ItemRow = typeof item.$inferSelect;

/** DB row → ItemInstance; default-valued columns stay absent so the wire profile stays small. */
function fromRow(r: ItemRow): ItemInstance {
  const i: ItemInstance = {
    id: r.id,
    def: r.def,
    kind: r.kind as ItemInstance['kind'],
    upgrade: r.upgrade,
  };
  if (r.rarity !== 'standard') i.rarity = r.rarity as Rarity;
  const mods = r.mods as ItemInstance['mods'];
  if (mods?.length) i.mods = mods;
  if (r.count !== 1) i.count = r.count;
  if (r.msLeft !== null) i.msLeft = r.msLeft;
  if (r.bag !== null) i.bag = r.bag;
  return i;
}

/**
 * The Pilot behind a session token; a fresh guest (memory only) for no/invalid token or no DB.
 * First sign-in creates the Pilot with the given name and nation; afterwards the stored ones win.
 * The returned object is the live profile: mutate it in place, `saveProfile` persists it.
 */
export async function loadProfile(
  token: unknown,
  name: string,
  nation: NationId,
): Promise<PilotProfile> {
  const accountId = accountFromToken(token);
  if (!db || !accountId) return guest(name, nation);
  const created = await db
    .insert(pilot)
    .values({ accountId, name, nation, ...STARTING_WALLET })
    .onConflictDoNothing()
    .returning({ id: pilot.id });
  const [p] = await db.select().from(pilot).where(eq(pilot.accountId, accountId));
  const items = await db.select().from(item).where(eq(item.pilotId, p!.id));
  const loadouts = await db.select().from(loadout).where(eq(loadout.pilotId, p!.id));
  const profile: PilotProfile = {
    name: p!.name,
    nation: p!.nation as NationId,
    level: p!.level,
    xp: p!.xp,
    wallet: { credits: p!.credits, scrap: p!.scrap, glory: p!.glory },
    items: items.map(fromRow),
    loadouts: Object.fromEntries(loadouts.map((l) => [l.frame as FrameId, l.slots as Loadout])),
    charms: p!.charms as (ItemId | null)[],
    guest: false,
  };
  pilotIds.set(profile, p!.id);
  if (created.length) {
    giveStartingConsumables(profile);
    void saveProfile(profile);
  } else assignBags(profile);
  return profile;
}

/** Persist a profile from `loadProfile`. No-op for guests. Never throws; writes run in order. */
export function saveProfile(profile: PilotProfile): Promise<void> {
  const pilotId = pilotIds.get(profile);
  if (!db || !pilotId) return Promise.resolve();
  const d = db;
  const next = (writes.get(profile) ?? Promise.resolve())
    .then(() =>
      // ponytail: rewrites all items/loadouts each save; fine for tens of items per Pilot.
      d.transaction(async (tx) => {
        const { wallet } = profile;
        await tx
          .update(pilot)
          .set({ level: profile.level, xp: profile.xp, ...wallet, charms: profile.charms })
          .where(eq(pilot.id, pilotId));
        await tx.delete(item).where(eq(item.pilotId, pilotId));
        await tx.delete(loadout).where(eq(loadout.pilotId, pilotId));
        if (profile.items.length)
          await tx.insert(item).values(
            profile.items.map((i) => ({
              id: i.id,
              pilotId,
              def: i.def,
              kind: i.kind,
              upgrade: i.upgrade,
              rarity: i.rarity ?? 'standard',
              mods: i.mods ?? [],
              count: i.count ?? 1,
              msLeft: i.msLeft ?? null,
              bag: i.bag ?? null,
            })),
          );
        const frames = Object.entries(profile.loadouts);
        if (frames.length)
          await tx
            .insert(loadout)
            .values(frames.map(([frame, slots]) => ({ pilotId, frame, slots: slots ?? {} })));
      }),
    )
    .catch((err: Error) => console.warn(`[profiles] save ${profile.name} failed: ${err.message}`));
  writes.set(profile, next);
  return next;
}
