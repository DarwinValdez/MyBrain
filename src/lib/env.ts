// Environment access. NEXT_PUBLIC_* values are inlined into the browser bundle
// and must never hold secrets; everything else is read on the server only.

export type PublicSupabaseEnv = { url: string; key: string };

export function readPublicSupabaseEnv(): PublicSupabaseEnv | null {
  // Referenced literally so Next.js can inline them into client bundles.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return readPublicSupabaseEnv() !== null;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const env = readPublicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return env;
}
