import pg from "pg";
import { readFileSync } from "node:fs";

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
    // SSL configuration for Supabase using explicit CA certificate
    // This is production-safe: we trust Supabase's CA, not all self-signed certs
    let sslConfig: { ca: string } | undefined;
    try {
      const caCert = readFileSync("/certs/supabase-ca.pem", "utf8");
      sslConfig = { ca: caCert };
      console.log("[DB] Pool SSL config: using Supabase CA certificate");
    } catch (err) {
      console.warn("[DB] Could not load Supabase CA certificate from /certs/supabase-ca.pem:", err instanceof Error ? err.message : String(err));
      console.warn("[DB] Falling back to default SSL verification (may fail with self-signed cert error)");
      // If cert file doesn't exist, let pg use default SSL behavior
      // This allows local dev without the cert file, but production must have it
    }
    
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ...(sslConfig && { ssl: sslConfig }),
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
