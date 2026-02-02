#!/usr/bin/env node
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "migrations");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      const name = f.replace(/\.sql$/, "");
      const result = await client.query(
        "SELECT 1 FROM _migrations WHERE name = $1",
        [name]
      );
      if (result.rows.length > 0) {
        console.log("Skip (already applied):", name);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, f), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
      console.log("Applied:", name);
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
