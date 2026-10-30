import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// M2 persistence stub. Server is the only writer (docs/ARCHITECTURE.md §5).
export const account = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  discordId: text('discord_id').unique(),
  role: text('role').notNull().default('player'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const pilot = pgTable('pilot', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => account.id),
  name: text('name').notNull().unique(),
  nation: text('nation').notNull(),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  credits: integer('credits').notNull().default(0),
  scrap: integer('scrap').notNull().default(0),
  glory: integer('glory').notNull().default(0),
});
