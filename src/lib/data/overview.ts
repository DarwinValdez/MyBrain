import "server-only";
import type { AuthContext } from "@/lib/auth";

async function count(ctx: AuthContext, table: "memories" | "projects" | "conversations") {
  const { count: value, error } = await ctx.supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ctx.user.id);
  if (error) throw error;
  return value ?? 0;
}

export async function getOverviewStats(ctx: AuthContext) {
  const [memories, projects, conversations, indexed] = await Promise.all([
    count(ctx, "memories"),
    count(ctx, "projects"),
    count(ctx, "conversations"),
    (async () => {
      const { count: value, error } = await ctx.supabase
        .from("memories")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ctx.user.id)
        .eq("index_status", "indexed");
      if (error) throw error;
      return value ?? 0;
    })(),
  ]);
  return { memories, projects, conversations, indexed };
}

/** Memories created per day for the last `days` days (oldest first). */
export async function getActivity(ctx: AuthContext, days = 30, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const { data, error } = await ctx.supabase
    .from("memories")
    .select("created_at")
    .eq("owner_id", ctx.user.id)
    .gte("created_at", start.toISOString())
    .limit(5000);
  if (error) throw error;
  return bucketByDay((data ?? []).map((row) => row.created_at), start, days);
}

export function bucketByDay(timestamps: string[], start: Date, days: number) {
  const buckets = Array.from({ length: days }, (_, i) => {
    const day = new Date(start.getTime() + i * 86_400_000);
    return { date: day.toISOString().slice(0, 10), count: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.date, i]));
  for (const ts of timestamps) {
    const i = index.get(ts.slice(0, 10));
    if (i !== undefined) buckets[i].count++;
  }
  return buckets;
}

/** AI-similar memories to the most recently indexed memory (suggestions, not facts). */
export async function getSuggestedRelated(ctx: AuthContext) {
  const { data: latest, error } = await ctx.supabase
    .from("memories")
    .select("id, title")
    .eq("owner_id", ctx.user.id)
    .eq("index_status", "indexed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!latest) return null;
  const { data: similar, error: rpcError } = await ctx.supabase.rpc("similar_memories", {
    p_memory_id: latest.id,
    match_count: 4,
    min_similarity: 0.45,
  });
  if (rpcError) throw rpcError;
  return { source: latest, similar: similar ?? [] };
}
