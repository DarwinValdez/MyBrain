import { describe, expect, it, vi } from "vitest";
import { indexMemory } from "@/lib/indexing";
import { hasCall, firstOp } from "./helpers/fake-supabase";
import { createFakeSupabase } from "./helpers/fake-supabase";

const memory = { id: "m-1", title: "Title", content: "Some content to index.", content_hash: "hash-1" };
const config = { provider: "voyage" as const, apiKey: "k", model: "voyage-3.5" };

describe("indexMemory", () => {
  it("embeds chunks and replaces them atomically with the content hash", async () => {
    const fake = createFakeSupabase({ rpc: () => ({ data: true }) });
    const embed = vi.fn(async (_c: unknown, texts: string[]) => texts.map(() => [0.5, 0.25]));
    const result = await indexMemory(fake.client, memory, config, embed);

    expect(result).toEqual({ status: "indexed" });
    expect(embed).toHaveBeenCalledWith(config, ["Title\n\nSome content to index."], "document");
    expect(fake.rpcs).toHaveLength(1);
    expect(fake.rpcs[0]).toMatchObject({
      fn: "replace_memory_chunks",
      args: {
        p_memory_id: "m-1",
        p_content_hash: "hash-1",
        p_chunks: [{ chunk_index: 0, content: "Some content to index.", embedding: "[0.5,0.25]" }],
      },
    });
  });

  it("indexes title-only memories", async () => {
    const fake = createFakeSupabase({ rpc: () => ({ data: true }) });
    const embed = vi.fn(async (_c: unknown, texts: string[]) => texts.map(() => [1]));
    await indexMemory(fake.client, { ...memory, content: "" }, config, embed);
    expect(embed).toHaveBeenCalledWith(config, ["Title\n\nTitle"], "document");
  });

  it("reports stale when the memory changed during embedding", async () => {
    const fake = createFakeSupabase({ rpc: () => ({ data: false }) });
    const result = await indexMemory(fake.client, memory, config, vi.fn(async () => [[1]]));
    expect(result).toEqual({ status: "stale" });
  });

  it("marks the memory failed (never deletes it) when the provider fails", async () => {
    const fake = createFakeSupabase();
    const embed = vi.fn(async () => {
      throw new Error("provider down");
    });
    const result = await indexMemory(fake.client, memory, config, embed);

    expect(result).toEqual({ status: "failed", error: "provider down" });
    expect(fake.queries).toHaveLength(1);
    const query = fake.queries[0];
    expect(query.table).toBe("memories");
    expect(firstOp(query)).toEqual({ method: "update", args: [{ index_status: "failed", index_error: "provider down" }] });
    expect(hasCall(query, "eq", "id", "m-1")).toBe(true);
    expect(hasCall(query, "eq", "content_hash", "hash-1")).toBe(true);
    expect(query.calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("records a clear reason when embeddings aren't configured", async () => {
    const fake = createFakeSupabase();
    const result = await indexMemory(fake.client, memory, null);
    expect(result).toMatchObject({ status: "failed", error: expect.stringMatching(/EMBEDDING_API_KEY/) });
    expect(fake.rpcs).toHaveLength(0);
  });
});
