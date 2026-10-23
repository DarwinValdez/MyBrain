import "server-only";
import { z } from "zod";
import { GROQ_BASE_URL, type Effort, type GenerationConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/errors";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const TIMEOUT_MS = 55_000;

const responseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({ content: z.string().nullable().optional() }),
      }),
    )
    .min(1),
});

/** gpt-oss models accept a reasoning effort of low | medium | high. */
function reasoningEffort(model: string, effort: Effort): "low" | "medium" | "high" | undefined {
  if (!model.startsWith("openai/gpt-oss")) return undefined;
  return effort === "low" || effort === "medium" ? effort : "high";
}

/** Some open models wrap their reasoning in <think> tags inside the content. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export function buildGroqRequest(
  config: GenerationConfig,
  params: { system: string; messages: ChatTurn[]; json?: boolean; maxTokens?: number; effort?: Effort },
) {
  const effort = reasoningEffort(config.model, params.effort ?? config.effort);
  return {
    url: `${config.baseUrl ?? GROQ_BASE_URL}/chat/completions`,
    body: {
      model: config.model,
      messages: [{ role: "system", content: params.system }, ...params.messages],
      max_completion_tokens: params.maxTokens ?? 8192,
      ...(effort ? { reasoning_effort: effort } : {}),
      ...(params.json ? { response_format: { type: "json_object" } } : {}),
    },
  };
}

/** Call Groq's OpenAI-compatible chat completions endpoint. */
export async function groqChat(
  config: GenerationConfig,
  params: { system: string; messages: ChatTurn[]; json?: boolean; maxTokens?: number; effort?: Effort },
  fetchImpl: typeof fetch = fetch,
): Promise<{ text: string; truncated: boolean; model: string }> {
  const request = buildGroqRequest(config, params);
  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AiError("unavailable", "Could not reach the AI provider (Groq).");
  }

  if (response.status === 429) {
    throw new AiError("rate_limited", "Groq's free-tier limit was reached. Wait a minute and try again.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new AiError("auth", "Groq rejected the API key. Check AI_PROVIDER_API_KEY.");
  }
  if (response.status === 404) throw new AiError("bad_response", "The configured AI_MODEL isn't available on Groq.");
  if (response.status >= 500) throw new AiError("unavailable", `Groq returned an error (${response.status}).`);
  if (!response.ok) throw new AiError("bad_response", `Groq rejected the request (${response.status}).`);

  const parsed = responseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new AiError("bad_response", "Groq returned an unexpected response.");
  const choice = parsed.data.choices[0];
  const text = stripThinking(choice.message.content ?? "");
  if (!text) throw new AiError("bad_response", "The AI model returned an empty answer.");
  return { text, truncated: choice.finish_reason === "length", model: parsed.data.model ?? config.model };
}
