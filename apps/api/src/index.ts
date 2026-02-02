import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { jobRoutes } from "./routes/jobs.js";
import { generateRoutes } from "./routes/generate.js";
import { interpretRoutes } from "./routes/interpret.js";
import { debugRoutes } from "./routes/debug.js";

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err);
  console.error("[FATAL] Stack:", err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("[FATAL] Unhandled rejection:", err);
  if (err instanceof Error) {
    console.error("[FATAL] Stack:", err.stack);
  }
  process.exit(1);
});

async function start() {
  const app = Fastify({ logger: true });

  // CORS first: no other plugins or routes before it. OPTIONS preflight must see CORS headers.
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Build-Id"],
    optionsSuccessStatus: 204,
    preflight: true,
    strictPreflight: false,
  });

  // All routes and logging after CORS so CORS hooks run first on every request
  await app.register(async (instance) => {
    console.log("[API] Environment check:", {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL?.length ?? 0,
      gcsBucket: process.env.GCS_BUCKET ?? "not set",
      projectId: process.env.GCP_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? "not set",
    });
    await instance.register(healthRoutes, { prefix: "/" });
    await instance.register(interpretRoutes, { prefix: "/" });
    await instance.register(jobRoutes, { prefix: "/jobs" });
    await instance.register(generateRoutes, { prefix: "/generate" });
    await instance.register(debugRoutes, { prefix: "/debug" });
  });

  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.ready();
  console.log("[API] Fastify ready, starting server...");
  await app.listen({ port, host });
  console.log(`API listening on ${host}:${port}`);
}

start().catch((err) => {
  console.error("[FATAL] API failed to start:", err);
  if (err instanceof Error) {
    console.error("[FATAL] Stack:", err.stack);
  }
  process.exit(1);
});
