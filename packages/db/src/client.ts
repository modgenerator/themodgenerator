import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Parse a PostgreSQL connection URL and return safe info (no password).
 * Format: postgresql://user:password@host:port/database
 */
function parseConnectionUrl(url: string): { username: string; host: string; port: string; database: string } | null {
  try {
    const parsed = new URL(url);
    return {
      username: parsed.username || "unknown",
      host: parsed.hostname || "unknown",
      port: parsed.port || "5432",
      database: parsed.pathname?.slice(1) || "unknown",
    };
  } catch {
    return null;
  }
}

export function getPool(connectionString?: string): pg.Pool {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  
  // Log connection info (without password) for debugging
  const connInfo = parseConnectionUrl(url);
  if (connInfo) {
    console.log("[DB] Connection info:", {
      username: connInfo.username,
      host: connInfo.host,
      port: connInfo.port,
      database: connInfo.database,
      urlLength: url.length,
      hasPassword: url.includes("@") && url.split("@")[0].includes(":"),
    });
  } else {
    console.warn("[DB] Could not parse DATABASE_URL format");
  }
  
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
      // For Supabase transaction pooler (pgBouncer), we should avoid prepared statements
      // However, pg library uses parameterized queries which are fine with transaction pooler
      // The issue is if we use named prepared statements, which we don't
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
