const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });

const migrationsDirectory = path.join(process.cwd(), "migrations");

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local before starting the app.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query("SELECT pg_advisory_lock(hashtext('boardgame_card_studio_migrations'))");

    const files = (await fs.readdir(migrationsDirectory))
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();
    const { rows } = await client.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) continue;

      const migration = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
      await client.query(migration);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      console.log(`Applied migration: ${file}`);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('boardgame_card_studio_migrations'))").catch(() => {});
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
