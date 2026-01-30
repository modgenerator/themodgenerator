import type { FastifyPluginAsync } from "fastify";
import { interpretWithClarification } from "@themodgenerator/generator";

/**
 * POST /interpretWithClarification
 * Body: { prompt: string }
 * Returns: ClarificationResponse (request_clarification | proceed with normalized prompt)
 */
export const interpretRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { prompt?: string } }>("/interpretWithClarification", async (req, reply) => {
    const prompt = req.body?.prompt;
    const input = prompt != null ? String(prompt).trim() : "";
    const response = interpretWithClarification(input);
    return reply.status(200).send(response);
  });
};
