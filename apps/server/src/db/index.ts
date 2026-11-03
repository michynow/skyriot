import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';

export { schema };
export type Db = ReturnType<typeof drizzle<typeof schema>>;

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://skyriot:skyriot@localhost:5432/skyriot';

async function openDb(): Promise<Db | null> {
  const sql = postgres(DATABASE_URL, { max: 5, connect_timeout: 3, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  try {
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
    });
    return db;
  } catch (err) {
    console.warn(
      `[db] Postgres unavailable, all Pilots play as guests (${((err as Error).cause as Error | undefined)?.message ?? (err as Error).message})`,
    );
    await sql.end({ timeout: 1 }).catch(() => {});
    return null;
  }
}

/** Connected + migrated database, or null when Postgres is unreachable (everyone plays as guest). */
export const db = await openDb();
