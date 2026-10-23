// Route classification shared by the proxy and tests.

/** Pages and APIs that require a signed-in user. */
export const PROTECTED_PREFIXES = [
  "/overview",
  "/memories",
  "/recall",
  "/graph",
  "/projects",
  "/settings",
  "/api",
] as const;

/** Pages that only make sense when signed out. */
export const AUTH_PAGES = ["/login", "/signup"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isApiPath(pathname: string): boolean {
  return matchesPrefix(pathname, "/api");
}

/**
 * Only allow same-origin relative redirects (e.g. "/memories?page=2"), so a
 * crafted ?next= parameter can't send users to another site.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/overview"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

export type ProxyDecision =
  | { action: "next" }
  | { action: "redirect"; to: string }
  | { action: "unauthorized" };

/** Optimistic routing decision. Pages and APIs still verify auth themselves. */
export function decideRoute(pathname: string, search: string, isSignedIn: boolean): ProxyDecision {
  if (!isSignedIn && isProtectedPath(pathname)) {
    if (isApiPath(pathname)) return { action: "unauthorized" };
    const next = encodeURIComponent(`${pathname}${search}`);
    return { action: "redirect", to: `/login?next=${next}` };
  }
  if (isSignedIn && (pathname === "/" || isAuthPage(pathname))) {
    return { action: "redirect", to: "/overview" };
  }
  return { action: "next" };
}
