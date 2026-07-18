import "server-only";

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local before using the database.");
}

const globalForDb = globalThis as typeof globalThis & { pgPool?: Pool };

export const db = globalForDb.pgPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = db;
}
