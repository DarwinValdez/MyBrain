import { describe, expect, it } from "vitest";
import { decideRoute, isProtectedPath, safeRedirectPath } from "@/lib/routes";

describe("route protection", () => {
  it.each(["/overview", "/memories", "/memories/abc/edit", "/recall", "/graph", "/projects/x", "/settings", "/api/recall", "/api/export"])(
    "protects %s",
    (path) => expect(isProtectedPath(path)).toBe(true),
  );

  it.each(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/confirm", "/setup", "/memoriesx"])(
    "does not protect %s",
    (path) => expect(isProtectedPath(path)).toBe(false),
  );

  it("redirects signed-out page requests to login with a return path", () => {
    expect(decideRoute("/memories", "?page=2", false)).toEqual({ action: "redirect", to: "/login?next=%2Fmemories%3Fpage%3D2" });
  });

  it("answers signed-out API requests with 401 instead of a redirect", () => {
    expect(decideRoute("/api/recall", "", false)).toEqual({ action: "unauthorized" });
  });

  it("sends signed-in users from auth pages to the app", () => {
    expect(decideRoute("/login", "", true)).toEqual({ action: "redirect", to: "/overview" });
    expect(decideRoute("/", "", true)).toEqual({ action: "redirect", to: "/overview" });
    expect(decideRoute("/forgot-password", "", true)).toEqual({ action: "next" });
    expect(decideRoute("/memories", "", true)).toEqual({ action: "next" });
  });

  it("only allows same-origin redirect targets", () => {
    expect(safeRedirectPath("/memories?x=1")).toBe("/memories?x=1");
    expect(safeRedirectPath("https://evil.example")).toBe("/overview");
    expect(safeRedirectPath("//evil.example")).toBe("/overview");
    expect(safeRedirectPath("/\\evil.example")).toBe("/overview");
    expect(safeRedirectPath(null)).toBe("/overview");
  });
});
