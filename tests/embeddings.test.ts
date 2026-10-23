import { describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIMENSIONS, getAiConfig } from "@/lib/ai/config";
import { buildRequest, embedTexts, toPgVector } from "@/lib/ai/embeddings";
import { AiError } from "@/lib/ai/errors";

const voyage = { provider: "voyage" as const, apiKey: "test-key", model: "voyage-3.5" };
const vector = (seed: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? seed : 0));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("embedTexts", () => {
  it("requests the configured dimension from each provider", () => {
    expect(buildRequest(voyage, ["a"], "query").body).toMatchObject({ input_type: "query", output_dimension: 1024 });
    expect(buildRequest({ provider: "openai", apiKey: "k", model: "text-embedding-3-small" }, ["a"], "document").body).toMatchObject({
      dimensions: 1024,
    });
  });

  it("returns vectors in input order and sends the key only as a header", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: [{ index: 1, embedding: vector(2) }, { index: 0, embedding: vector(1) }] }),
    );
    const result = await embedTexts(voyage, ["first", "second"], "document", fetchMock as unknown as typeof fetch);
    expect(result.map((v) => v[0])).toEqual([1, 2]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.voyageai.com/v1/embeddings");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    expect(String(init.body)).not.toContain("test-key");
  });

  it("rejects vectors with the wrong dimension", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [{ index: 0, embedding: [1, 2, 3] }] }));
    await expect(embedTexts(voyage, ["x"], "query", fetchMock as unknown as typeof fetch)).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("surfaces bad credentials without retrying", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "nope" }, 401));
    await expect(embedTexts(voyage, ["x"], "query", fetchMock as unknown as typeof fetch)).rejects.toBeInstanceOf(AiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries rate limits, then reports them", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => jsonResponse({}, 429));
    const promise = embedTexts(voyage, ["x"], "query", fetchMock as unknown as typeof fetch);
    const assertion = expect(promise).rejects.toMatchObject({ kind: "rate_limited", status: 429 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("formats pgvector literals", () => {
    expect(toPgVector([0.1, -2])).toBe("[0.1,-2]");
  });
});

describe("getAiConfig", () => {
  it("disables features when keys are missing", () => {
    expect(getAiConfig({} as NodeJS.ProcessEnv)).toEqual({ generation: null, embeddings: null });
  });

  it("applies defaults", () => {
    const config = getAiConfig({ AI_PROVIDER_API_KEY: "a", EMBEDDING_API_KEY: "b", EMBEDDING_PROVIDER: "openai" } as unknown as NodeJS.ProcessEnv);
    expect(config.generation).toEqual({ apiKey: "a", model: "claude-opus-5-5", effort: "medium" });
    expect(config.embeddings).toEqual({ provider: "openai", apiKey: "b", model: "text-embedding-3-small" });
  });
});
