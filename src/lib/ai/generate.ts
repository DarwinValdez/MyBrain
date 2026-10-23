import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { GenerationConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/errors";

/** Models that accept the server-side refusal fallback ("fallbacks": "default"). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export type GeneratedAnswer = { text: string; truncated: boolean; model: string };

/**
 * Generate an answer with the Anthropic Messages API. Streams internally (and
 * collects the final message) so long answers don't hit HTTP timeouts.
 */
export async function generateAnswer(
  config: GenerationConfig,
  params: { system: string; messages: Anthropic.MessageParam[] },
): Promise<GeneratedAnswer> {
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 2, timeout: 55_000 });
  const useFallbacks = FALLBACK_MODELS.has(config.model);

  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = client.beta.messages.stream({
      model: config.model,
      max_tokens: 16_000,
      thinking: { type: "adaptive" },
      output_config: { effort: config.effort },
      system: params.system,
      messages: params.messages,
      ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    message = await stream.finalMessage();
  } catch (error) {
    throw toAiError(error);
  }

  if (message.stop_reason === "refusal") {
    throw new AiError("refused", "The AI model declined to answer this question.");
  }

  const text = message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) throw new AiError("bad_response", "The AI model returned an empty answer.");

  return { text, truncated: message.stop_reason === "max_tokens", model: message.model };
}

export function toAiError(error: unknown): AiError {
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError("rate_limited", "The AI provider is rate limiting requests. Please try again in a moment.");
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError("auth", "The AI provider rejected the configured API key.");
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new AiError("bad_response", "The configured AI_MODEL was not found.");
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AiError("bad_response", "The AI provider rejected the request.");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError("unavailable", "Could not reach the AI provider.");
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError("unavailable", `The AI provider returned an error${error.status ? ` (${error.status})` : ""}.`);
  }
  return new AiError("unavailable", "The AI request failed.");
}
