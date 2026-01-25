#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const migrationsDir = path.join(__dirname, "..", "migrations");
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
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      const name = path.basename(f, ".sql");
          const [{ rows }] = await client.query(
            "SELECT 1 FROM _migrations WHERE name = $1",
            [name]
          );
      if (rows.length > 0) {
        console.log("Skip (already applied):", name);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
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
