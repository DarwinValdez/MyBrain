"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { memoryContentHash } from "@/lib/hash";
import { indexMemory } from "@/lib/indexing";
import {
  fieldErrors,
  formDataToObject,
  idSchema,
  memoryInputSchema,
  quickCaptureSchema,
  type MemoryInput,
} from "@/lib/validation";
import type { ActionState } from "@/app/actions/types";

const NOT_SIGNED_IN: ActionState = { ok: false, message: "Your session has expired. Sign in again." };

function revalidateMemoryViews(id?: string) {
  revalidatePath("/overview");
  revalidatePath("/memories");
  revalidatePath("/graph");
  revalidatePath("/projects", "layout");
  if (id) revalidatePath(`/memories/${id}`);
}

function indexingMessage(status: string) {
  return status === "failed" ? "Saved. Semantic indexing failed — you can retry from the memory page." : undefined;
}

/** A project id from a form must belong to the caller; RLS + FK enforce it too. */
async function assertOwnProject(ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>, projectId: string | null) {
  if (!projectId) return true;
  const { data } = await ctx.supabase.from("projects").select("id").eq("owner_id", ctx.user.id).eq("id", projectId).maybeSingle();
  return Boolean(data);
}

function toRow(input: MemoryInput) {
  return {
    title: input.title,
    content: input.content,
    type: input.type,
    tags: input.tags,
    project_id: input.projectId,
    source_url: input.sourceUrl,
    source_notes: input.sourceNotes,
    content_hash: memoryContentHash(input.title, input.content),
  };
}

export async function createMemoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;

  const values = formDataToObject(formData);
  const parsed = memoryInputSchema.safeParse(values);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };
  if (!(await assertOwnProject(ctx, parsed.data.projectId))) {
    return { ok: false, errors: { projectId: "Project not found." }, values };
  }

  const row = toRow(parsed.data);
  const { data, error } = await ctx.supabase
    .from("memories")
    .insert({ ...row, owner_id: ctx.user.id })
    .select("id, title, content, content_hash")
    .single();
  if (error) {
    console.error("create memory failed", error);
    return { ok: false, message: "Could not save the memory. Please try again.", values };
  }

  await indexMemory(ctx.supabase, data);
  revalidateMemoryViews(data.id);
  redirect(`/memories/${data.id}`);
}

export async function updateMemoryAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Memory not found." };

  const values = formDataToObject(formData);
  const parsed = memoryInputSchema.safeParse(values);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };
  if (!(await assertOwnProject(ctx, parsed.data.projectId))) {
    return { ok: false, errors: { projectId: "Project not found." }, values };
  }

  const { data, error } = await ctx.supabase
    .from("memories")
    .update(toRow(parsed.data))
    .eq("owner_id", ctx.user.id)
    .eq("id", id)
    .select("id, title, content, content_hash, index_status")
    .maybeSingle();
  if (error) {
    console.error("update memory failed", error);
    return { ok: false, message: "Could not save changes. Please try again.", values };
  }
  if (!data) return { ok: false, message: "Memory not found." };

  // The database resets index_status to 'pending' when the text changes.
  if (data.index_status !== "indexed") await indexMemory(ctx.supabase, data);
  revalidateMemoryViews(id);
  redirect(`/memories/${id}`);
}

export async function deleteMemoryAction(id: string): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Memory not found." };

  // Chunks (embeddings) and relationships are removed by ON DELETE CASCADE.
  const { error, count } = await ctx.supabase
    .from("memories")
    .delete({ count: "exact" })
    .eq("owner_id", ctx.user.id)
    .eq("id", id);
  if (error) {
    console.error("delete memory failed", error);
    return { ok: false, message: "Could not delete the memory." };
  }
  if (!count) return { ok: false, message: "Memory not found." };
  revalidateMemoryViews();
  redirect("/memories");
}

export async function quickCaptureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;

  const values = formDataToObject(formData);
  const parsed = quickCaptureSchema.safeParse(values);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const { title, content, type, tags } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("memories")
    .insert({
      owner_id: ctx.user.id,
      title,
      content,
      type,
      tags,
      content_hash: memoryContentHash(title, content),
    })
    .select("id, title, content, content_hash")
    .single();
  if (error) {
    console.error("quick capture failed", error);
    return { ok: false, message: "Could not save. Please try again.", values };
  }

  const result = await indexMemory(ctx.supabase, data);
  revalidateMemoryViews(data.id);
  return {
    ok: true,
    message: indexingMessage(result.status) ?? "Captured.",
    data: { id: data.id, title: data.title, indexStatus: result.status },
  };
}

export async function reindexMemoryAction(id: string): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Memory not found." };

  const { data, error } = await ctx.supabase
    .from("memories")
    .select("id, title, content, content_hash")
    .eq("owner_id", ctx.user.id)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Memory not found." };

  const result = await indexMemory(ctx.supabase, data);
  revalidateMemoryViews(id);
  if (result.status === "failed") return { ok: false, message: result.error };
  return { ok: true, message: "Indexed for semantic search." };
}

/** Associate (projectId) or disassociate (null) a memory and a project. */
export async function setMemoryProjectAction(memoryId: string, projectId: string | null): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(memoryId).success || (projectId !== null && !idSchema.safeParse(projectId).success)) {
    return { ok: false, message: "Invalid request." };
  }
  if (!(await assertOwnProject(ctx, projectId))) return { ok: false, message: "Project not found." };

  const { error, count } = await ctx.supabase
    .from("memories")
    .update({ project_id: projectId }, { count: "exact" })
    .eq("owner_id", ctx.user.id)
    .eq("id", memoryId);
  if (error || !count) return { ok: false, message: "Could not update the memory." };
  revalidateMemoryViews(memoryId);
  return { ok: true };
}
