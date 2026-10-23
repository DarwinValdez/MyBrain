"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { fieldErrors, formDataToObject, idSchema, projectInputSchema, type ProjectInput } from "@/lib/validation";
import type { ActionState } from "@/app/actions/types";

const NOT_SIGNED_IN: ActionState = { ok: false, message: "Your session has expired. Sign in again." };

function toRow(input: ProjectInput) {
  return {
    name: input.name,
    description: input.description,
    status: input.status,
    goals: input.goals,
    next_steps: input.nextSteps,
  };
}

function revalidateProjects(id?: string) {
  revalidatePath("/projects");
  revalidatePath("/overview");
  revalidatePath("/graph");
  revalidatePath("/memories");
  if (id) revalidatePath(`/projects/${id}`);
}

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  const values = formDataToObject(formData);
  const parsed = projectInputSchema.safeParse(values);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const { data, error } = await ctx.supabase
    .from("projects")
    .insert({ ...toRow(parsed.data), owner_id: ctx.user.id })
    .select("id")
    .single();
  if (error) {
    console.error("create project failed", error);
    return { ok: false, message: "Could not create the project.", values };
  }
  revalidateProjects(data.id);
  redirect(`/projects/${data.id}`);
}

export async function updateProjectAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Project not found." };
  const values = formDataToObject(formData);
  const parsed = projectInputSchema.safeParse(values);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const { error, count } = await ctx.supabase
    .from("projects")
    .update(toRow(parsed.data), { count: "exact" })
    .eq("owner_id", ctx.user.id)
    .eq("id", id);
  if (error) return { ok: false, message: "Could not save the project.", values };
  if (!count) return { ok: false, message: "Project not found." };
  revalidateProjects(id);
  redirect(`/projects/${id}`);
}

/** Deleting a project keeps its memories; they simply lose the association. */
export async function deleteProjectAction(id: string): Promise<ActionState> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_SIGNED_IN;
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Project not found." };
  const { error, count } = await ctx.supabase
    .from("projects")
    .delete({ count: "exact" })
    .eq("owner_id", ctx.user.id)
    .eq("id", id);
  if (error || !count) return { ok: false, message: "Could not delete the project." };
  revalidateProjects();
  redirect("/projects");
}
