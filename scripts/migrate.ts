import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Usage: tsx scripts/migrate.ts
// Target DB is selected via DATABASE_URL (see npm scripts db:migrate / db:migrate:test).
// override: tsx may pre-inject .env; an explicit DOTENV_PATH (e.g. .env.test) must win.
config({ path: process.env.DOTENV_PATH ?? ".env", override: true });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log(`Migrations applied to ${connectionString.replace(/:[^:@/]+@/, ":****@")}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
