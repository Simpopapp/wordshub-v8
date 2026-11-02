/**
 * Server functions de tradução IA (PRD projeto 11, §2.2/§8). O módulo entra no
 * grafo do cliente, mas só o corpo dos handlers é retirado do bundle: as
 * importações de servidor (`@/server/gateway`) são dinâmicas, dentro do handler.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildPhrasePrompt, buildWordPrompt } from "@/lib/plus/aiPrompts";
import { phraseResultSchema, wordResultSchema } from "@/lib/plus/aiSchemas";

export type AiTranslationError = {
  ok: false;
  code: "credits" | "rate" | "network" | "invalid";
  message: string;
};
export type AiWordResponse =
  { ok: true; result: import("zod").infer<typeof wordResultSchema> } | AiTranslationError;
export type AiPhraseResponse =
  { ok: true; result: import("zod").infer<typeof phraseResultSchema> } | AiTranslationError;

export const translateAiWord = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        word: z.string().min(1),
        sentence: z.string().min(1),
        questionText: z.string().optional(),
        taskType: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<AiWordResponse> => {
    const { callGatewayObject } = await import("@/server/gateway");
    const prompt = buildWordPrompt(data);
    const result = await callGatewayObject({
      instructions: prompt.instructions,
      messages: prompt.messages,
      schema: wordResultSchema,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, result: result.data };
  });

export const translateAiPhrase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sentence: z.string().min(1),
        taskType: z.string().min(1),
        questionText: z.string().optional(),
        options: z.array(z.string()).optional(),
        neighbors: z.array(z.string()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<AiPhraseResponse> => {
    const { callGatewayObject } = await import("@/server/gateway");
    const prompt = buildPhrasePrompt(data);
    const result = await callGatewayObject({
      instructions: prompt.instructions,
      messages: prompt.messages,
      schema: phraseResultSchema,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, result: result.data };
  });
