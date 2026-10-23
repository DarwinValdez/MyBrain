"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai/config";
import { isAiError } from "@/lib/ai/errors";
import { extractMemoriesFromTranscript, type ExtractedMemory } from "@/lib/ai/extract";
import { LIMITS, MEMORY_TYPES, VOICE } from "@/lib/constants";
import { memoryContentHash } from "@/lib/hash";
import { indexMemory } from "@/lib/indexing";
import { idSchema, normalizeTags } from "@/lib/validation";
import { nextPartTitle } from "@/lib/voice";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const NOT_SIGNED_IN = { ok: false as const, message: "Your session has expired. Sign in again." };

const appendSchema = z.object({
  sessionMemoryId: idSchema.nullable(),
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(VOICE.maxAppendChars),
});

/**
 * Append transcribed text to the current voice-session memory, creating it (or
 * a new "part" when it gets close to the size limit) as needed. Called
 * periodically while recording so long sessions are never lost.
 */
export async function appendVoiceTranscriptAction(
  input: z.input<typeof appendSchema>,
): Promise<Result<{ memoryId: string; title: string; length: number }>> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  const parsed = appendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid transcript." };
  const { sessionMemoryId, text } = parsed.data;
  let title = parsed.data.title;

  if (sessionMemoryId) {
    const { data: current, error } = await ctx.supabase
      .from("memories")
      .select("id, title, content")
      .eq("owner_id", ctx.user.id)
      .eq("id", sessionMemoryId)
      .maybeSingle();
    if (error) return { ok: false, message: "Could not save the transcript." };

    if (current && current.content.length + text.length + 1 <= VOICE.maxSessionChars) {
      const content = `${current.content}\n${text}`;
      const { data: updated, error: updateError } = await ctx.supabase
        .from("memories")
        .update({ content, content_hash: memoryContentHash(current.title, content) })
        .eq("owner_id", ctx.user.id)
        .eq("id", current.id)
        .select("id, title, content, content_hash")
        .single();
      if (updateError) return { ok: false, message: "Could not save the transcript." };
      await indexMemory(ctx.supabase, updated);
      revalidatePath("/memories");
      return { ok: true, data: { memoryId: updated.id, title: updated.title, length: updated.content.length } };
    }
    // Full (or deleted meanwhile): continue in a new part.
    if (current) title = nextPartTitle(current.title);
  }

  const { data: created, error: insertError } = await ctx.supabase
    .from("memories")
    .insert({
      owner_id: ctx.user.id,
      title,
      content: text,
      type: "note",
      tags: ["voice"],
      source_notes: "Voice transcript (browser speech recognition).",
      content_hash: memoryContentHash(title, text),
    })
    .select("id, title, content, content_hash")
    .single();
  if (insertError) return { ok: false, message: "Could not save the transcript." };
  await indexMemory(ctx.supabase, created);
  revalidatePath("/memories");
  revalidatePath("/overview");
  return { ok: true, data: { memoryId: created.id, title: created.title, length: created.content.length } };
}

/** Ask the AI to propose memories from a saved voice session. Nothing is saved yet. */
export async function extractFromVoiceSessionAction(sessionMemoryId: string): Promise<Result<ExtractedMemory[]>> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(sessionMemoryId).success) return { ok: false, message: "Session not found." };

  const ai = getAiConfig();
  if (!ai.generation) {
    return { ok: false, message: "AI extraction needs AI_PROVIDER_API_KEY. The transcript itself is saved and searchable." };
  }

  const { data: session } = await ctx.supabase
    .from("memories")
    .select("content")
    .eq("owner_id", ctx.user.id)
    .eq("id", sessionMemoryId)
    .maybeSingle();
  if (!session) return { ok: false, message: "Session not found." };
  if (!session.content.trim()) return { ok: true, data: [] };

  try {
    return { ok: true, data: await extractMemoriesFromTranscript(ai.generation, session.content) };
  } catch (error) {
    if (!isAiError(error)) console.error("voice extraction failed", error);
    return { ok: false, message: isAiError(error) ? error.message : "Extraction failed. Try again." };
  }
}

const itemsSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1).max(LIMITS.title),
      content: z.string().trim().min(1).max(LIMITS.content),
      type: z.enum(MEMORY_TYPES),
      tags: z.array(z.string()).max(LIMITS.tags).transform((tags) => normalizeTags(tags)),
    }),
  )
  .min(1)
  .max(VOICE.maxExtracted);

/** Save the proposals the user selected, linked to the session they came from. */
export async function saveExtractedMemoriesAction(
  sessionMemoryId: string,
  items: ExtractedMemory[],
  projectId: string | null,
): Promise<Result<{ ids: string[] }>> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  const parsed = itemsSchema.safeParse(items);
  if (!idSchema.safeParse(sessionMemoryId).success || !parsed.success) return { ok: false, message: "Invalid selection." };
  if (projectId !== null && !idSchema.safeParse(projectId).success) return { ok: false, message: "Invalid project." };

  const { data: session } = await ctx.supabase
    .from("memories")
    .select("id, title")
    .eq("owner_id", ctx.user.id)
    .eq("id", sessionMemoryId)
    .maybeSingle();
  if (!session) return { ok: false, message: "Session not found." };
  if (projectId) {
    const { data: project } = await ctx.supabase.from("projects").select("id").eq("owner_id", ctx.user.id).eq("id", projectId).maybeSingle();
    if (!project) return { ok: false, message: "Project not found." };
  }

  const { data: created, error } = await ctx.supabase
    .from("memories")
    .insert(
      parsed.data.map((item) => ({
        owner_id: ctx.user.id,
        title: item.title,
        content: item.content,
        type: item.type,
        tags: [...new Set([...item.tags, "voice"])].slice(0, LIMITS.tags),
        project_id: projectId,
        source_notes: `Extracted by AI from the voice session “${session.title}”. Review for transcription errors.`.slice(0, LIMITS.sourceNotes),
        content_hash: memoryContentHash(item.title, item.content),
      })),
    )
    .select("id, title, content, content_hash");
  if (error || !created) return { ok: false, message: "Could not save the selected memories." };

  // Link each new memory back to the transcript it came from (the user chose to keep it).
  await ctx.supabase.from("memory_relationships").insert(
    created.map((memory) => ({
      owner_id: ctx.user.id,
      source_memory_id: memory.id,
      target_memory_id: session.id,
      relation_type: "follows" as const,
      status: "accepted" as const,
      origin: "user" as const,
      reason: "Extracted from voice session",
    })),
  );
  for (const memory of created) await indexMemory(ctx.supabase, memory);

  revalidatePath("/memories");
  revalidatePath("/overview");
  revalidatePath("/graph");
  return { ok: true, data: { ids: created.map((m) => m.id) } };
}
