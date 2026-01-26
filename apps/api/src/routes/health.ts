import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/health", async () => ({ ok: true }));
};
