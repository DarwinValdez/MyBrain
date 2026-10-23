import "server-only";
import type { AuthContext } from "@/lib/auth";
import type { Project } from "@/lib/database.types";

export async function listProjects({ supabase, user }: AuthContext): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function getProject({ supabase, user }: AuthContext, id: string): Promise<Project | null> {
  const { data, error } = await supabase.from("projects").select("*").eq("owner_id", user.id).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Memory counts per project id. */
export async function projectMemoryCounts({ supabase, user }: AuthContext): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("memories")
    .select("project_id")
    .eq("owner_id", user.id)
    .not("project_id", "is", null)
    .limit(5000);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) if (row.project_id) counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
  return counts;
}
