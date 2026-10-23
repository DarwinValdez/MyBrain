import { describe, expect, it, vi } from "vitest";
import { mergeResults, retrieveContext, RETRIEVAL, type KeywordRow, type SemanticRow } from "@/lib/ai/retrieval";
import { createFakeSupabase } from "./helpers/fake-supabase";

vi.mock("@/lib/ai/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/embeddings")>();
  return { ...actual, embedTexts: vi.fn(async () => [[0.1, 0.2]]) };
});

function semantic(memoryId: string, chunkIndex: number, similarity: number, content = `chunk ${chunkIndex} of ${memoryId}`): SemanticRow {
  return {
    chunk_id: Math.floor(similarity * 1000),
    memory_id: memoryId,
    chunk_index: chunkIndex,
    content,
    similarity,
    title: `Title ${memoryId}`,
    type: "note",
    tags: [],
    project_id: null,
    memory_created_at: "2026-01-01T00:00:00Z",
    memory_updated_at: "2026-01-02T00:00:00Z",
  };
}

function keyword(memoryId: string, content = `content of ${memoryId}`): KeywordRow {
  return {
    memory_id: memoryId,
    title: `Title ${memoryId}`,
    content,
    type: "fact",
    tags: ["t"],
    project_id: null,
    rank: 0.5,
    memory_created_at: "2026-01-01T00:00:00Z",
    memory_updated_at: "2026-01-02T00:00:00Z",
  };
}

describe("mergeResults", () => {
  it("groups chunks per memory, fuses ranks, and numbers items from 1", () => {
    const items = mergeResults(
      [semantic("a", 2, 0.9), semantic("b", 0, 0.8), semantic("a", 0, 0.7), semantic("a", 5, 0.6)],
      [keyword("b"), keyword("c")],
    );
    expect(items.map((i) => i.memoryId)).toEqual(["b", "a", "c"]);
    expect(items.map((i) => i.index)).toEqual([1, 2, 3]);
    const a = items.find((i) => i.memoryId === "a")!;
    expect(a.excerpt).toBe("chunk 0 of a\n…\nchunk 2 of a"); // max 2 chunks, in document order
    expect(items[0].matchedBy).toEqual(["semantic", "keyword"]);
    expect(items[2].excerpt).toBe("content of c");
  });

  it("caps items and total context size", () => {
    const rows = Array.from({ length: 20 }, (_, i) => keyword(`m${i}`, "x".repeat(5000)));
    const items = mergeResults([], rows);
    expect(items.length).toBeLessThanOrEqual(RETRIEVAL.maxItems);
    const total = items.reduce((n, i) => n + i.excerpt.length, 0);
    expect(total).toBeLessThanOrEqual(RETRIEVAL.maxTotalChars);
  });
});

describe("retrieveContext", () => {
  it("passes the project scope to both searches", async () => {
    const fake = createFakeSupabase({
      rpc: (fn) => ({ data: fn === "match_memory_chunks" ? [semantic("a", 0, 0.8)] : [keyword("b")] }),
    });
    const result = await retrieveContext(fake.client, {
      question: "q",
      projectId: "p-1",
      embeddings: { provider: "voyage", apiKey: "k", model: "m" },
    });
    expect(fake.rpcs.map((r) => r.fn)).toEqual(["match_memory_chunks", "keyword_search_memories"]);
    for (const call of fake.rpcs) expect(call.args.filter_project_id).toBe("p-1");
    expect(result.semanticUsed).toBe(true);
    expect(result.items.map((i) => i.memoryId)).toEqual(["a", "b"]);
  });

  it("falls back to keyword search when embeddings aren't configured", async () => {
    const fake = createFakeSupabase({ rpc: () => ({ data: [keyword("b")] }) });
    const result = await retrieveContext(fake.client, { question: "q", projectId: null, embeddings: null });
    expect(fake.rpcs.map((r) => r.fn)).toEqual(["keyword_search_memories"]);
    expect(result.semanticUsed).toBe(false);
    expect(result.notice).toMatch(/keyword search only/);
  });

  it("falls back to keyword search when semantic search fails", async () => {
    const fake = createFakeSupabase({
      rpc: (fn) => (fn === "match_memory_chunks" ? { error: { message: "boom" } } : { data: [keyword("b")] }),
    });
    const result = await retrieveContext(fake.client, {
      question: "q",
      projectId: null,
      embeddings: { provider: "voyage", apiKey: "k", model: "m" },
    });
    expect(result.items).toHaveLength(1);
    expect(result.semanticUsed).toBe(false);
  });
});
