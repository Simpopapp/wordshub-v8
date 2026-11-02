/**
 * Server-only: acesso ao Lovable AI Gateway. NUNCA importar por código de
 * cliente — o provider e a chave vivem exclusivamente no servidor; este módulo
 * só deve entrar na árvore via import dinâmico dentro do handler de uma server
 * function (PRD projeto 11, D2/D3).
 */
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./run-id.ts";

const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";
const DEFAULT_MODEL = "openai/gpt-6-astra";
const RETRY_DELAY_MS = 800;

export type AiErrorCode = "credits" | "rate" | "network" | "invalid";

export type AiCallResult<T> =
  { ok: true; data: T } | { ok: false; code: AiErrorCode; message: string };

export interface GatewayObjectInput<S> {
  instructions: string;
  messages: ModelMessage[];
  schema: S;
}

function safeMessage(error: unknown): string {
  if (
    error != null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message.slice(0, 200);
  }
  return "Falha inesperada na chamada de IA.";
}

/** Mapeia um erro do gateway/AI SDK para o código tipado consumido pelo cliente. */
export function classifyGatewayError(error: unknown): { code: AiErrorCode; message: string } {
  if (NoObjectGeneratedError.isInstance(error)) {
    return { code: "invalid", message: "Resposta da IA fora do formato esperado." };
  }
  const candidate = error as {
    statusCode?: unknown;
    status?: unknown;
    name?: unknown;
    message?: unknown;
  };
  const status =
    typeof candidate?.statusCode === "number"
      ? candidate.statusCode
      : typeof candidate?.status === "number"
        ? candidate.status
        : undefined;
  if (typeof status === "number") {
    if (status === 402) return { code: "credits", message: "Créditos de IA esgotados." };
    if (status === 429 || status >= 500)
      return { code: "rate", message: "Limite temporário da IA atingido." };
    return { code: "invalid", message: safeMessage(error) };
  }
  if (
    error instanceof TypeError ||
    /fetch|network|ECONN|ENOTFOUND/i.test(
      String(candidate?.name) + " " + String(candidate?.message),
    )
  ) {
    return { code: "network", message: "Sem comunicação com a IA." };
  }
  return { code: "invalid", message: safeMessage(error) };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Uma chamada ao gateway com saída estruturada (strict json_schema via
 * /v1/responses). Cria o provider por requisição, streama a chamada e consome
 * o resultado final no servidor. 429/5xx recebem exatamente um retry com
 * backoff; os demais códigos são terminais (D3/D10).
 */
export async function callGatewayObject<S extends import("zod").ZodType>(
  input: GatewayObjectInput<S>,
): Promise<AiCallResult<import("zod").infer<S>>> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return { ok: false, code: "invalid", message: "Servidor sem chave de IA configurada." };
  }

  const runOnce = async (): Promise<import("zod").infer<S>> => {
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: GATEWAY_BASE_URL,
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const result = streamText({
      model: provider.responses(DEFAULT_MODEL),
      instructions: input.instructions,
      messages: input.messages,
      output: Output.object({ schema: input.schema }),
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    return (await result.output) as import("zod").infer<S>;
  };

  try {
    return { ok: true, data: await runOnce() };
  } catch (error) {
    const first = classifyGatewayError(error);
    if (first.code === "rate") {
      await delay(RETRY_DELAY_MS);
      try {
        return { ok: true, data: await runOnce() };
      } catch (retryError) {
        return { ok: false, ...classifyGatewayError(retryError) };
      }
    }
    return { ok: false, ...first };
  }
}
