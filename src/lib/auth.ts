import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };
export type AuthContext = { user: SessionUser; supabase: ServerSupabaseClient };

/** Verified user for this request, or null. Deduplicated per request. */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  // Session checks compare token expiry with the current time, so they must
  // never run during prerendering or runtime prefetching.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { user: { id: sub, email }, supabase };
});

/** For pages: redirect to the login page when signed out. */
export async function requireUser(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "UnauthorizedError";
  }
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function requireUserForAction(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}
