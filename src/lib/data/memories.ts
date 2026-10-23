import "server-only";
import type { AuthContext } from "@/lib/auth";
import type { Memory, MemoryRelationship, MemoryType } from "@/lib/database.types";
import { MEMORIES_PAGE_SIZE } from "@/lib/constants";
import type { MemoryFilters } from "@/lib/validation";

export type MemoryListItem = Pick<
  Memory,
  "id" | "title" | "content" | "type" | "tags" | "project_id" | "index_status" | "created_at" | "updated_at"
>;

const LIST_COLUMNS = "id, title, content, type, tags, project_id, index_status, created_at, updated_at";

/** PostgREST `or`/`ilike` filters need special characters removed. */
function sanitizeSearch(q: string): string {
  return q.replace(/[%_,()*\\:."']/g, " ").replace(/\s+/g, " ").trim();
}

export async function listMemories({ supabase, user }: AuthContext, filters: MemoryFilters) {
  const from = (filters.page - 1) * MEMORIES_PAGE_SIZE;
  let query = supabase
    .from("memories")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("owner_id", user.id);

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.project === "none") query = query.is("project_id", null);
  else if (filters.project) query = query.eq("project_id", filters.project);

  const q = filters.q ? sanitizeSearch(filters.q) : "";
  if (q) {
    // Full-text match on title/content, or a substring match on the title.
    query = query.or(`fts.wfts(english).${q},title.ilike.*${q}*`);
  }

  const column = filters.sort === "updated" ? "updated_at" : "created_at";
  const { data, count, error } = await query
    .order(column, { ascending: filters.order === "asc" })
    .order("id", { ascending: true })
    .range(from, from + MEMORIES_PAGE_SIZE - 1);
  if (error) throw error;

  const total = count ?? 0;
  return {
    items: (data ?? []) as MemoryListItem[],
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / MEMORIES_PAGE_SIZE)),
  };
}

export async function getMemory({ supabase, user }: AuthContext, id: string): Promise<Memory | null> {
  const { data, error } = await supabase.from("memories").select("*").eq("owner_id", user.id).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listRecentMemories({ supabase, user }: AuthContext, limit = 5) {
  const { data, error } = await supabase
    .from("memories")
    .select(LIST_COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MemoryListItem[];
}

export async function listProjectMemories({ supabase, user }: AuthContext, projectId: string) {
  const { data, error } = await supabase
    .from("memories")
    .select(LIST_COLUMNS)
    .eq("owner_id", user.id)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as MemoryListItem[];
}

/** Tag usage counts across the user's memories. */
export async function listTags({ supabase, user }: AuthContext) {
  const { data, error } = await supabase.from("memories").select("tags").eq("owner_id", user.id).limit(2000);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}

export type RelatedMemory = {
  relationship: MemoryRelationship;
  other: { id: string; title: string; type: MemoryType };
};

/** Accepted and suggested links for one memory, with the linked memory's title. */
export async function listMemoryRelationships({ supabase, user }: AuthContext, memoryId: string): Promise<RelatedMemory[]> {
  const { data: relationships, error } = await supabase
    .from("memory_relationships")
    .select("*")
    .eq("owner_id", user.id)
    .neq("status", "rejected")
    .or(`source_memory_id.eq.${memoryId},target_memory_id.eq.${memoryId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!relationships?.length) return [];

  const otherIds = relationships.map((r) => (r.source_memory_id === memoryId ? r.target_memory_id : r.source_memory_id));
  const { data: others, error: othersError } = await supabase
    .from("memories")
    .select("id, title, type")
    .eq("owner_id", user.id)
    .in("id", otherIds);
  if (othersError) throw othersError;
  const byId = new Map((others ?? []).map((m) => [m.id, m]));

  return relationships.flatMap((relationship) => {
    const otherId = relationship.source_memory_id === memoryId ? relationship.target_memory_id : relationship.source_memory_id;
    const other = byId.get(otherId);
    return other ? [{ relationship, other }] : [];
  });
}

/** Lightweight list for pickers (link a memory, etc.). */
export async function listMemoryOptions({ supabase, user }: AuthContext, excludeId?: string) {
  let query = supabase.from("memories").select("id, title").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(300);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
