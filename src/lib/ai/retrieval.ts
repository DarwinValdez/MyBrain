import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, MemoryType } from "@/lib/database.types";
import type { EmbeddingConfig } from "@/lib/ai/config";
import { embedTexts, toPgVector } from "@/lib/ai/embeddings";
import { isAiError } from "@/lib/ai/errors";

type Functions = Database["public"]["Functions"];
export type SemanticRow = Functions["match_memory_chunks"]["Returns"][number];
export type KeywordRow = Functions["keyword_search_memories"]["Returns"][number];

/** One retrieved memory, numbered for citation as [index]. */
export type ContextItem = {
  index: number;
  memoryId: string;
  title: string;
  type: MemoryType;
  tags: string[];
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  excerpt: string;
  score: number;
  similarity: number | null;
  matchedBy: ("semantic" | "keyword")[];
};

export const RETRIEVAL = {
  semanticCandidates: 16,
  keywordCandidates: 8,
  minSimilarity: 0.25,
  maxItems: 8,
  maxChunksPerMemory: 2,
  maxExcerptChars: 2000,
  maxTotalChars: 16_000,
  rrfK: 60,
} as const;

/**
 * Reciprocal-rank fusion of semantic chunk hits and keyword memory hits,
 * grouped per memory. Pure function, so ranking is easy to test.
 */
export function mergeResults(semantic: SemanticRow[], keyword: KeywordRow[]): ContextItem[] {
  type Acc = Omit<ContextItem, "index" | "excerpt"> & { chunks: { index: number; content: string }[]; fallback: string };
  const byMemory = new Map<string, Acc>();

  const memoryRank = new Map<string, number>();
  for (const row of semantic) {
    if (!memoryRank.has(row.memory_id)) memoryRank.set(row.memory_id, memoryRank.size);
  }

  for (const row of semantic) {
    let acc = byMemory.get(row.memory_id);
    if (!acc) {
      acc = {
        memoryId: row.memory_id,
        title: row.title,
        type: row.type,
        tags: row.tags,
        projectId: row.project_id,
        createdAt: row.memory_created_at,
        updatedAt: row.memory_updated_at,
        score: 1 / (RETRIEVAL.rrfK + (memoryRank.get(row.memory_id) ?? 0) + 1),
        similarity: row.similarity,
        matchedBy: ["semantic"],
        chunks: [],
        fallback: "",
      };
      byMemory.set(row.memory_id, acc);
    }
    if (acc.chunks.length < RETRIEVAL.maxChunksPerMemory) {
      acc.chunks.push({ index: row.chunk_index, content: row.content });
    }
  }

  keyword.forEach((row, rank) => {
    const contribution = 1 / (RETRIEVAL.rrfK + rank + 1);
    const existing = byMemory.get(row.memory_id);
    if (existing) {
      existing.score += contribution;
      existing.matchedBy.push("keyword");
      return;
    }
    byMemory.set(row.memory_id, {
      memoryId: row.memory_id,
      title: row.title,
      type: row.type,
      tags: row.tags,
      projectId: row.project_id,
      createdAt: row.memory_created_at,
      updatedAt: row.memory_updated_at,
      score: contribution,
      similarity: null,
      matchedBy: ["keyword"],
      chunks: [],
      fallback: row.content,
    });
  });

  const ranked = [...byMemory.values()].sort((a, b) => b.score - a.score).slice(0, RETRIEVAL.maxItems);

  let budget = RETRIEVAL.maxTotalChars;
  const items: ContextItem[] = [];
  for (const acc of ranked) {
    if (budget <= 200) break;
    const text = acc.chunks.length
      ? acc.chunks
          .sort((a, b) => a.index - b.index)
          .map((chunk) => chunk.content)
          .join("\n…\n")
      : acc.fallback;
    const excerpt = truncate(text, Math.min(RETRIEVAL.maxExcerptChars, budget));
    budget -= excerpt.length;
    const { chunks: _chunks, fallback: _fallback, ...rest } = acc;
    void _chunks;
    void _fallback;
    items.push({ ...rest, index: items.length + 1, excerpt });
  }
  return items;
}

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export type RetrievalResult = {
  items: ContextItem[];
  /** False when semantic search was skipped or failed; keyword search still ran. */
  semanticUsed: boolean;
  notice: string | null;
};

/**
 * Hybrid retrieval for the signed-in user. Both RPCs run as the user, so RLS
 * and the explicit auth.uid() filters inside them restrict results to their
 * own memories; projectId narrows further when a project scope is chosen.
 */
export async function retrieveContext(
  supabase: ServerSupabaseClient,
  params: { question: string; projectId: string | null; embeddings: EmbeddingConfig | null },
): Promise<RetrievalResult> {
  let semantic: SemanticRow[] = [];
  let semanticUsed = false;
  let notice: string | null = null;

  if (params.embeddings) {
    try {
      const [vector] = await embedTexts(params.embeddings, [params.question], "query");
      const { data, error } = await supabase.rpc("match_memory_chunks", {
        query_embedding: toPgVector(vector),
        match_count: RETRIEVAL.semanticCandidates,
        filter_project_id: params.projectId,
        min_similarity: RETRIEVAL.minSimilarity,
      });
      if (error) throw error;
      semantic = data ?? [];
      semanticUsed = true;
    } catch (error) {
      notice = isAiError(error)
        ? `Semantic search unavailable (${error.message}). Used keyword search only.`
        : "Semantic search failed. Used keyword search only.";
    }
  } else {
    notice = "Semantic search is not configured (no EMBEDDING_API_KEY). Used keyword search only.";
  }

  const { data: keyword, error: keywordError } = await supabase.rpc("keyword_search_memories", {
    query_text: params.question,
    match_count: RETRIEVAL.keywordCandidates,
    filter_project_id: params.projectId,
  });
  if (keywordError) throw keywordError;

  return { items: mergeResults(semantic, keyword ?? []), semanticUsed, notice };
}
