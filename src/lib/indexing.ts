import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { getAiConfig, type EmbeddingConfig } from "@/lib/ai/config";
import { chunkText, embeddingInput } from "@/lib/ai/chunking";
import { embedTexts, toPgVector } from "@/lib/ai/embeddings";
import { isAiError } from "@/lib/ai/errors";

export type IndexableMemory = { id: string; title: string; content: string; content_hash: string };
export type IndexResult = { status: "indexed" } | { status: "stale" } | { status: "failed"; error: string };

/**
 * Chunk, embed and store a memory's text. Never throws and never deletes the
 * memory: on failure it records index_status = 'failed' with a reason so the
 * user can retry, and the memory stays available to keyword search.
 */
export async function indexMemory(
  supabase: ServerSupabaseClient,
  memory: IndexableMemory,
  config: EmbeddingConfig | null = getAiConfig().embeddings,
  embed: typeof embedTexts = embedTexts,
): Promise<IndexResult> {
  if (!config) {
    return markFailed(supabase, memory, "Embedding provider not configured (set EMBEDDING_API_KEY).");
  }

  try {
    const chunks = chunkText(memory.content);
    const parts = chunks.length ? chunks : [{ index: 0, content: memory.title }];
    const vectors = await embed(
      config,
      parts.map((chunk) => embeddingInput(memory.title, chunk.content)),
      "document",
    );

    const { data: applied, error } = await supabase.rpc("replace_memory_chunks", {
      p_memory_id: memory.id,
      p_content_hash: memory.content_hash,
      p_chunks: parts.map((chunk, i) => ({
        chunk_index: chunk.index,
        content: chunk.content,
        embedding: toPgVector(vectors[i]),
      })),
    });
    if (error) throw new Error("Could not store embeddings.");
    // false: the memory changed (or was deleted) while we were embedding it.
    return applied ? { status: "indexed" } : { status: "stale" };
  } catch (error) {
    const message = isAiError(error) ? error.message : error instanceof Error ? error.message : "Indexing failed.";
    return markFailed(supabase, memory, message);
  }
}

async function markFailed(supabase: ServerSupabaseClient, memory: IndexableMemory, message: string): Promise<IndexResult> {
  const error = message.slice(0, 500);
  // Only mark the version we tried to index; newer edits keep their own status.
  await supabase
    .from("memories")
    .update({ index_status: "failed", index_error: error })
    .eq("id", memory.id)
    .eq("content_hash", memory.content_hash);
  return { status: "failed", error };
}

/** Retry indexing for the caller's pending/failed memories, a batch at a time. */
export async function reindexOutstanding(supabase: ServerSupabaseClient, ownerId: string, limit = 20) {
  const { data, error } = await supabase
    .from("memories")
    .select("id, title, content, content_hash")
    .eq("owner_id", ownerId)
    .in("index_status", ["pending", "failed"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  let indexed = 0;
  let failed = 0;
  for (const memory of data ?? []) {
    const result = await indexMemory(supabase, memory);
    if (result.status === "indexed") indexed++;
    else if (result.status === "failed") failed++;
  }
  return { attempted: data?.length ?? 0, indexed, failed };
}
