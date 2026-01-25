import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { jobRoutes } from "./routes/jobs.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(healthRoutes, { prefix: "/" });
await app.register(jobRoutes, { prefix: "/jobs" });

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";
await app.listen({ port, host });
console.log(`API listening on ${host}:${port}`);
