import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Server is the only writer (docs/ARCHITECTURE.md §5). Migrations: `pnpm --filter @skyriot/server db:generate`;
// the server applies them on boot.
export const account = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  discordId: text('discord_id').unique(),
  role: text('role').notNull().default('player'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ponytail: one Pilot per account; add a pilot picker when multiple characters ship.
export const pilot = pgTable('pilot', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .notNull()
    .unique()
    .references(() => account.id),
  name: text('name').notNull(),
  nation: text('nation').notNull(),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  credits: integer('credits').notNull().default(0),
  scrap: integer('scrap').notNull().default(0),
  glory: integer('glory').notNull().default(0),
  /** Charm slots I–III: item ids or null. */
  charms: jsonb('charms').notNull().default([null, null, null]),
});

export const item = pgTable('item', {
  id: text('id').primaryKey(),
  pilotId: uuid('pilot_id')
    .notNull()
    .references(() => pilot.id),
  def: text('def').notNull(),
  kind: text('kind').notNull(),
  upgrade: integer('upgrade').notNull().default(0),
  rarity: text('rarity').notNull().default('standard'),
  /** Per Mod slot: chosen Mod id, or the three offered ids. */
  mods: jsonb('mods').notNull().default([]),
  count: integer('count').notNull().default(1),
  /** Charm: logged-in ms left after activation; null = not activated. */
  msLeft: integer('ms_left'),
  /** Bag cell; null while equipped. */
  bag: integer('bag'),
});

/** Per Frame: `slots` is a `Loadout` (item ids per gear slot, plus the optional `hotbar` layout). */
export const loadout = pgTable(
  'loadout',
  {
    pilotId: uuid('pilot_id')
      .notNull()
      .references(() => pilot.id),
    frame: text('frame').notNull(),
    slots: jsonb('slots').notNull(),
  },
  (t) => [primaryKey({ columns: [t.pilotId, t.frame] })],
);
