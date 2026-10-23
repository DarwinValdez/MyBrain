import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { readPublicSupabaseEnv } from "@/lib/env";
import { decideRoute } from "@/lib/routes";

/**
 * Refreshes the Supabase session cookie on every request and performs an
 * optimistic auth redirect. This is a convenience layer: every page, server
 * action and API route re-checks the session on the server, and RLS enforces
 * ownership in the database.
 */
export async function updateSession(request: NextRequest) {
  const env = readPublicSupabaseEnv();
  const { pathname, search } = request.nextUrl;

  if (!env) {
    // Not configured yet: send everything except the setup page there.
    if (pathname === "/setup") return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims() verifies the JWT; don't run code between client creation and
  // this call (see Supabase SSR docs).
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  const decision = decideRoute(pathname, search, isSignedIn);
  if (decision.action === "unauthorized") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (decision.action === "redirect") {
    const redirect = NextResponse.redirect(new URL(decision.to, request.url));
    // Keep any refreshed auth cookies.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}
