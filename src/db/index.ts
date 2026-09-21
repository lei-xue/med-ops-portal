import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: AppDatabase;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
    );
  }
  return new Pool({ connectionString, max: 10 });
}

export function getPool(): Pool {
  if (!globalForDb.pool) {
    globalForDb.pool = createPool();
  }
  return globalForDb.pool;
}

export function getDb(): AppDatabase {
  if (!globalForDb.db) {
    globalForDb.db = drizzle(getPool(), { schema });
  }
  return globalForDb.db;
}

// Lazy, import-safe facades. `next build` imports route modules to collect page
// data; connecting (or throwing) at import time breaks that. Property access is
// forwarded to the real instance, which is created on first actual use.
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export const db: AppDatabase = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
