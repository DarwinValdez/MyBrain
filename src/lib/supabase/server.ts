import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { getPublicSupabaseEnv } from "@/lib/env";

/**
 * Supabase client bound to the current request's auth cookies. Queries run as
 * the signed-in user, so Row Level Security applies to everything it does.
 * Create a new client per request; never share one across requests.
 */
export async function createClient() {
  // Read cookies first: it marks the render as request-time before anything else runs.
  const cookieStore = await cookies();
  const { url, key } = getPublicSupabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
