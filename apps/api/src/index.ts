import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { jobRoutes } from "./routes/jobs.js";

const app = Fastify({ logger: true });

// Register CORS BEFORE routes to ensure preflight requests are handled
await app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return cb(null, true);
    const allowed = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];
    if (allowed.includes(origin)) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

await app.register(healthRoutes, { prefix: "/" });
await app.register(jobRoutes, { prefix: "/jobs" });

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";
await app.listen({ port, host });
console.log(`API listening on ${host}:${port}`);
