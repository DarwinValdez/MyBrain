import "server-only";
import type { AuthContext } from "@/lib/auth";
import type { MemoryType, ProjectStatus, RelationStatus, RelationType } from "@/lib/database.types";

export type GraphData = {
  memories: { id: string; title: string; type: MemoryType; tags: string[]; projectId: string | null; createdAt: string }[];
  projects: { id: string; name: string; status: ProjectStatus }[];
  relationships: {
    id: string;
    source: string;
    target: string;
    type: RelationType;
    status: Exclude<RelationStatus, "rejected">;
    origin: "user" | "ai";
    reason: string;
  }[];
  truncated: boolean;
};

const MAX_GRAPH_MEMORIES = 300;

export async function getGraphData({ supabase, user }: AuthContext): Promise<GraphData> {
  const [memories, projects, relationships] = await Promise.all([
    supabase
      .from("memories")
      .select("id, title, type, tags, project_id, created_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(MAX_GRAPH_MEMORIES + 1),
    supabase.from("projects").select("id, name, status").eq("owner_id", user.id).limit(500),
    supabase
      .from("memory_relationships")
      .select("id, source_memory_id, target_memory_id, relation_type, status, origin, reason")
      .eq("owner_id", user.id)
      .neq("status", "rejected")
      .limit(2000),
  ]);
  if (memories.error) throw memories.error;
  if (projects.error) throw projects.error;
  if (relationships.error) throw relationships.error;

  const memoryRows = memories.data ?? [];
  const truncated = memoryRows.length > MAX_GRAPH_MEMORIES;
  const kept = memoryRows.slice(0, MAX_GRAPH_MEMORIES);
  const keptIds = new Set(kept.map((m) => m.id));

  return {
    memories: kept.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      tags: m.tags,
      projectId: m.project_id,
      createdAt: m.created_at,
    })),
    projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.name, status: p.status })),
    relationships: (relationships.data ?? [])
      .filter((r) => keptIds.has(r.source_memory_id) && keptIds.has(r.target_memory_id))
      .map((r) => ({
        id: r.id,
        source: r.source_memory_id,
        target: r.target_memory_id,
        type: r.relation_type,
        status: r.status as Exclude<RelationStatus, "rejected">,
        origin: r.origin,
        reason: r.reason,
      })),
    truncated,
  };
}
