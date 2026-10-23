import { z } from "zod";

/**
 * The database stores vector(1024). Both embedding providers are asked for
 * exactly this many dimensions, and responses with a different size are
 * rejected before they reach the database.
 */
export const EMBEDDING_DIMENSIONS = 1024;

export const DEFAULT_AI_MODEL = "claude-opus-5-5";
export const DEFAULT_EMBEDDING_MODELS = {
  voyage: "voyage-3.5",
  openai: "text-embedding-3-small",
} as const;

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];
export type EmbeddingProvider = keyof typeof DEFAULT_EMBEDDING_MODELS;

const optional = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

const aiEnvSchema = z.object({
  AI_PROVIDER_API_KEY: optional,
  AI_MODEL: optional,
  AI_EFFORT: z.enum(EFFORTS).optional().catch(undefined),
  EMBEDDING_PROVIDER: z.enum(["voyage", "openai"]).optional().catch(undefined),
  EMBEDDING_API_KEY: optional,
  EMBEDDING_MODEL: optional,
});

export type GenerationConfig = { apiKey: string; model: string; effort: Effort };
export type EmbeddingConfig = { provider: EmbeddingProvider; apiKey: string; model: string };

export type AiConfig = {
  generation: GenerationConfig | null;
  embeddings: EmbeddingConfig | null;
};

/**
 * Reads AI settings from server-only environment variables. Missing values
 * disable the feature instead of crashing, so the rest of NEXUS still works.
 */
export function getAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const parsed = aiEnvSchema.parse(env);

  const generation: GenerationConfig | null = parsed.AI_PROVIDER_API_KEY
    ? {
        apiKey: parsed.AI_PROVIDER_API_KEY,
        model: parsed.AI_MODEL ?? DEFAULT_AI_MODEL,
        effort: parsed.AI_EFFORT ?? "medium",
      }
    : null;

  const provider: EmbeddingProvider = parsed.EMBEDDING_PROVIDER ?? "voyage";
  const embeddings: EmbeddingConfig | null = parsed.EMBEDDING_API_KEY
    ? {
        provider,
        apiKey: parsed.EMBEDDING_API_KEY,
        model: parsed.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODELS[provider],
      }
    : null;

  return { generation, embeddings };
}

/** Non-secret summary for the settings page. */
export function describeAiConfig(config: AiConfig = getAiConfig()) {
  return {
    generation: config.generation
      ? { configured: true as const, provider: "Anthropic", model: config.generation.model, effort: config.generation.effort }
      : { configured: false as const },
    embeddings: config.embeddings
      ? {
          configured: true as const,
          provider: config.embeddings.provider === "voyage" ? "Voyage AI" : "OpenAI",
          model: config.embeddings.model,
          dimensions: EMBEDDING_DIMENSIONS,
        }
      : { configured: false as const },
  };
}
