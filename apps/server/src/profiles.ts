import { eq } from 'drizzle-orm';
import {
  STARTING_WALLET,
  type FrameId,
  type ItemInstance,
  type Loadout,
  type NationId,
  type PilotProfile,
} from '@skyriot/shared';
import { accountFromToken } from './auth';
import { db, schema } from './db';

const { pilot, item, loadout } = schema;
const pilotIds = new WeakMap<PilotProfile, string>();
const writes = new WeakMap<PilotProfile, Promise<void>>();

function guest(name: string, nation: NationId): PilotProfile {
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
  await db.insert(pilot).values({ accountId, name, nation, ...STARTING_WALLET }).onConflictDoNothing();
  const [p] = await db.select().from(pilot).where(eq(pilot.accountId, accountId));
  const items = await db.select().from(item).where(eq(item.pilotId, p!.id));
  const loadouts = await db.select().from(loadout).where(eq(loadout.pilotId, p!.id));
  const profile: PilotProfile = {
    name: p!.name,
    nation: p!.nation as NationId,
    level: p!.level,
    xp: p!.xp,
    wallet: { credits: p!.credits, scrap: p!.scrap, glory: p!.glory },
    items: items.map(({ id, def, kind, upgrade }) => ({ id, def, kind, upgrade }) as ItemInstance),
    loadouts: Object.fromEntries(loadouts.map((l) => [l.frame as FrameId, l.slots as Loadout])),
    guest: false,
  };
  pilotIds.set(profile, p!.id);
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
          .set({ level: profile.level, xp: profile.xp, ...wallet })
          .where(eq(pilot.id, pilotId));
        await tx.delete(item).where(eq(item.pilotId, pilotId));
        await tx.delete(loadout).where(eq(loadout.pilotId, pilotId));
        if (profile.items.length)
          await tx.insert(item).values(profile.items.map((i) => ({ ...i, pilotId })));
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
