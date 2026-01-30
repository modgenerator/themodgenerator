import type { FastifyPluginAsync } from "fastify";
import { interpretWithClarification } from "@themodgenerator/generator";

/**
 * POST /interpretWithClarification
 * Body: { prompt: string, seed?: string | number }
 * Returns: ClarificationResponse verbatim (request_clarification | proceed).
 * No transformation, no AI chatter, no swallowing errors.
 */
export const interpretRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { prompt: string; seed?: string | number } }>("/interpretWithClarification", async (req, reply) => {
    const prompt = req.body?.prompt;
    const input = typeof prompt === "string" ? prompt.trim() : "";
    const response = interpretWithClarification(input);
    return reply.status(200).send(response);
  });
};
