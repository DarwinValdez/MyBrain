"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { idSchema, relationshipInputSchema, formDataToObject, fieldErrors } from "@/lib/validation";
import type { ActionState } from "@/app/actions/types";

const NOT_SIGNED_IN: ActionState = { ok: false, message: "Your session has expired. Sign in again." };

function revalidate(...memoryIds: string[]) {
  revalidatePath("/graph");
  revalidatePath("/overview");
  for (const id of memoryIds) revalidatePath(`/memories/${id}`);
}

/** User-made connection: accepted immediately. */
export async function createRelationshipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;

  const parsed = relationshipInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { sourceMemoryId, targetMemoryId, relationType } = parsed.data;

  // Upsert on the unordered pair: if an AI suggestion (or rejected one) exists, the user's choice replaces it.
  const { data: existing } = await ctx.supabase
    .from("memory_relationships")
    .select("id")
    .eq("owner_id", ctx.user.id)
    .or(
      `and(source_memory_id.eq.${sourceMemoryId},target_memory_id.eq.${targetMemoryId}),and(source_memory_id.eq.${targetMemoryId},target_memory_id.eq.${sourceMemoryId})`,
    )
    .maybeSingle();

  const { error } = existing
    ? await ctx.supabase
        .from("memory_relationships")
        .update({ status: "accepted", relation_type: relationType })
        .eq("owner_id", ctx.user.id)
        .eq("id", existing.id)
    : await ctx.supabase.from("memory_relationships").insert({
        owner_id: ctx.user.id,
        source_memory_id: sourceMemoryId,
        target_memory_id: targetMemoryId,
        relation_type: relationType,
        status: "accepted",
        origin: "user",
      });
  if (error) {
    // Foreign keys reject memories that don't belong to the caller.
    return { ok: false, message: "Could not link these memories." };
  }
  revalidate(sourceMemoryId, targetMemoryId);
  return { ok: true, message: "Connection saved." };
}

/**
 * Ask for AI-suggested connections based on embedding similarity. Suggestions
 * are stored with status 'suggested' and are never treated as facts until the
 * user accepts them. Pairs the user already linked or rejected are skipped.
 */
export async function suggestConnectionsAction(memoryId: string): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(memoryId).success) return { ok: false, message: "Memory not found." };

  const { data: similar, error } = await ctx.supabase.rpc("similar_memories", {
    p_memory_id: memoryId,
    match_count: 5,
    min_similarity: 0.5,
  });
  if (error) return { ok: false, message: "Could not compute suggestions." };
  if (!similar?.length) {
    return { ok: true, message: "No sufficiently similar memories found (the memory must be indexed first)." };
  }

  const { data: existing } = await ctx.supabase
    .from("memory_relationships")
    .select("source_memory_id, target_memory_id")
    .eq("owner_id", ctx.user.id)
    .or(`source_memory_id.eq.${memoryId},target_memory_id.eq.${memoryId}`);
  const linked = new Set(
    (existing ?? []).map((r) => (r.source_memory_id === memoryId ? r.target_memory_id : r.source_memory_id)),
  );

  const rows = similar
    .filter((s) => !linked.has(s.memory_id))
    .map((s) => ({
      owner_id: ctx.user.id,
      source_memory_id: memoryId,
      target_memory_id: s.memory_id,
      relation_type: "related" as const,
      status: "suggested" as const,
      origin: "ai" as const,
      reason: `Semantic similarity ${Math.round(s.similarity * 100)}% — suggested by AI, not verified.`,
      score: s.similarity,
    }));
  if (rows.length) {
    const { error: insertError } = await ctx.supabase.from("memory_relationships").insert(rows);
    if (insertError) return { ok: false, message: "Could not save suggestions." };
  }
  revalidate(memoryId);
  return { ok: true, message: rows.length ? `${rows.length} suggestion(s) added for review.` : "No new suggestions." };
}

export async function reviewSuggestionAction(id: string, decision: "accepted" | "rejected"): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(id).success || (decision !== "accepted" && decision !== "rejected")) {
    return { ok: false, message: "Invalid request." };
  }
  const { data, error } = await ctx.supabase
    .from("memory_relationships")
    .update({ status: decision })
    .eq("owner_id", ctx.user.id)
    .eq("id", id)
    .select("source_memory_id, target_memory_id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Suggestion not found." };
  revalidate(data.source_memory_id, data.target_memory_id);
  return { ok: true };
}

export async function deleteRelationshipAction(id: string): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Invalid request." };
  const { data, error } = await ctx.supabase
    .from("memory_relationships")
    .delete()
    .eq("owner_id", ctx.user.id)
    .eq("id", id)
    .select("source_memory_id, target_memory_id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Connection not found." };
  revalidate(data.source_memory_id, data.target_memory_id);
  return { ok: true };
}
