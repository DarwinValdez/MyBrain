"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { reindexOutstanding } from "@/lib/indexing";
import { idSchema } from "@/lib/validation";
import type { ActionState } from "@/app/actions/types";

const NOT_SIGNED_IN: ActionState = { ok: false, message: "Your session has expired. Sign in again." };

export async function signOutAction() {
  const ctx = await getAuthContext();
  if (ctx) await ctx.supabase.auth.signOut();
  redirect("/login");
}

const profileSchema = z.object({ displayName: z.string().trim().max(80) });

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  const parsed = profileSchema.safeParse({ displayName: formData.get("displayName") ?? "" });
  if (!parsed.success) return { ok: false, errors: { displayName: "At most 80 characters." } };
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName || null })
    .eq("id", ctx.user.id);
  if (error) return { ok: false, message: "Could not update your profile." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile updated." };
}

export async function reindexOutstandingAction(): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  try {
    const result = await reindexOutstanding(ctx.supabase, ctx.user.id);
    revalidatePath("/settings");
    revalidatePath("/memories");
    if (result.attempted === 0) return { ok: true, message: "Nothing to index — all memories are up to date." };
    return {
      ok: result.failed === 0,
      message: `Indexed ${result.indexed} of ${result.attempted} memories${result.failed ? `; ${result.failed} failed` : ""}.`,
    };
  } catch {
    return { ok: false, message: "Re-indexing failed." };
  }
}

export async function deleteConversationAction(id: string): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Conversation not found." };
  const { error } = await ctx.supabase.from("conversations").delete().eq("owner_id", ctx.user.id).eq("id", id);
  if (error) return { ok: false, message: "Could not delete the conversation." };
  revalidatePath("/recall");
  return { ok: true };
}

const confirmSchema = z.object({ confirm: z.literal("DELETE") });

function confirmed(formData: FormData) {
  return confirmSchema.safeParse({ confirm: formData.get("confirm") }).success;
}

export async function deleteAllConversationsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!confirmed(formData)) return { ok: false, errors: { confirm: 'Type DELETE to confirm.' } };
  const { error } = await ctx.supabase.from("conversations").delete().eq("owner_id", ctx.user.id);
  if (error) return { ok: false, message: "Could not delete conversations." };
  revalidatePath("/recall");
  revalidatePath("/overview");
  return { ok: true, message: "All conversations deleted." };
}

export async function deleteAllMemoriesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!confirmed(formData)) return { ok: false, errors: { confirm: 'Type DELETE to confirm.' } };
  // Embeddings and relationships cascade with their memories.
  const { error } = await ctx.supabase.from("memories").delete().eq("owner_id", ctx.user.id);
  if (error) return { ok: false, message: "Could not delete memories." };
  revalidatePath("/", "layout");
  return { ok: true, message: "All memories and their embeddings were deleted." };
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!confirmed(formData)) return { ok: false, errors: { confirm: 'Type DELETE to confirm.' } };

  // Deletes the auth user; every user-owned row is removed by ON DELETE CASCADE.
  const { error } = await ctx.supabase.rpc("delete_own_account");
  if (error) {
    console.error("delete account failed", error);
    return { ok: false, message: "Could not delete your account. Please try again." };
  }
  await ctx.supabase.auth.signOut();
  redirect("/login?deleted=1");
}
