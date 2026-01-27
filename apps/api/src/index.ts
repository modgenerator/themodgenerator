import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { jobRoutes } from "./routes/jobs.js";
import { generateRoutes } from "./routes/generate.js";

const app = Fastify({ logger: true });

// Register CORS BEFORE routes to ensure preflight requests are handled
await app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
});

// Log environment check (without exposing secrets)
console.log("[API] Environment check:", {
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  databaseUrlLength: process.env.DATABASE_URL?.length ?? 0,
  gcsBucket: process.env.GCS_BUCKET ?? "not set",
  projectId: process.env.GCP_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? "not set",
});

await app.register(healthRoutes, { prefix: "/" });
await app.register(jobRoutes, { prefix: "/jobs" });
await app.register(generateRoutes, { prefix: "/generate" });

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";
await app.listen({ port, host });
console.log(`API listening on ${host}:${port}`);
