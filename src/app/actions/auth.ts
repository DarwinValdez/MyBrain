"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/routes";
import { fieldErrors } from "@/lib/validation";
import type { ActionState } from "@/app/actions/types";

const email = z.email("Enter a valid email address.").max(254);
const password = z.string().min(8, "Use at least 8 characters.").max(128);

/** Public base URL for auth email links. Prefer an explicit setting in production. */
async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password.").max(128) }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Don't reveal whether the account exists.
    const message =
      error.code === "email_not_confirmed"
        ? "Confirm your email address first — check your inbox for the link."
        : "Incorrect email or password.";
    return { ok: false, message, values };
  }
  redirect(safeRedirectPath(String(formData.get("next") ?? "")));
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ email, password, confirmPassword: z.string() })
    .refine((v) => v.password === v.confirmPassword, { message: "Passwords don't match.", path: ["confirmPassword"] })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/overview` },
  });
  if (error) {
    return { ok: false, message: error.code === "weak_password" ? "Choose a stronger password." : "Could not create the account. Try again.", values };
  }
  // With email confirmation disabled Supabase returns a session immediately.
  if (data.session) redirect("/overview");
  return { ok: true, message: "Check your email for a confirmation link to finish signing up." };
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/reset-password`,
  });
  // Same response whether or not the account exists.
  return { ok: true, message: "If an account exists for that address, a reset link is on its way." };
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password, confirmPassword: z.string() })
    .refine((v) => v.password === v.confirmPassword, { message: "Passwords don't match.", path: ["confirmPassword"] })
    .safeParse({ password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { ok: false, message: "Your reset link has expired. Request a new one." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: "Could not update the password. Try a different one." };
  redirect("/overview?password=updated");
}
