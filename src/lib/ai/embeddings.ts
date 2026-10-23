import { z } from "zod";
import { EMBEDDING_DIMENSIONS, type EmbeddingConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/errors";

export type EmbeddingPurpose = "document" | "query";

const BATCH_SIZE = 64;
const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

const embeddingResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()), index: z.number() })),
});

/**
 * Embed texts with the configured provider (Voyage AI or OpenAI). Both are
 * asked for EMBEDDING_DIMENSIONS-dimensional vectors so they match the
 * vector(1024) column.
 */
export async function embedTexts(
  config: EmbeddingConfig,
  texts: string[],
  purpose: EmbeddingPurpose,
  fetchImpl: typeof fetch = fetch,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    results.push(...(await embedBatch(config, batch, purpose, fetchImpl)));
  }
  return results;
}

async function embedBatch(
  config: EmbeddingConfig,
  texts: string[],
  purpose: EmbeddingPurpose,
  fetchImpl: typeof fetch,
): Promise<number[][]> {
  const request = buildRequest(config, texts, purpose);

  let lastError: AiError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(request.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      lastError = new AiError("unavailable", "Could not reach the embedding provider.");
      await backoff(attempt);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      lastError =
        response.status === 429
          ? new AiError("rate_limited", "The embedding provider is rate limiting requests. Try again shortly.")
          : new AiError("unavailable", `The embedding provider returned ${response.status}.`);
      await backoff(attempt, response.headers.get("retry-after"));
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      throw new AiError("auth", "The embedding provider rejected the API key.");
    }
    if (!response.ok) {
      throw new AiError("bad_response", `The embedding provider returned ${response.status}.`);
    }

    const parsed = embeddingResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success || parsed.data.data.length !== texts.length) {
      throw new AiError("bad_response", "The embedding provider returned an unexpected response.");
    }
    const vectors = [...parsed.data.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
    if (vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) {
      throw new AiError(
        "bad_response",
        `Embedding model returned vectors that are not ${EMBEDDING_DIMENSIONS}-dimensional. Check EMBEDDING_MODEL.`,
      );
    }
    return vectors;
  }
  throw lastError ?? new AiError("unavailable", "Embedding request failed.");
}

export function buildRequest(config: EmbeddingConfig, texts: string[], purpose: EmbeddingPurpose) {
  if (config.provider === "voyage") {
    return {
      url: "https://api.voyageai.com/v1/embeddings",
      body: {
        model: config.model,
        input: texts,
        input_type: purpose,
        output_dimension: EMBEDDING_DIMENSIONS,
      },
    };
  }
  return {
    url: "https://api.openai.com/v1/embeddings",
    body: { model: config.model, input: texts, dimensions: EMBEDDING_DIMENSIONS },
  };
}

/** pgvector text format. */
export function toPgVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function backoff(attempt: number, retryAfter?: string | null) {
  if (attempt >= MAX_ATTEMPTS) return;
  const seconds = Number(retryAfter);
  const ms = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5000) : 400 * 2 ** (attempt - 1);
  await new Promise((resolve) => setTimeout(resolve, ms));
}
