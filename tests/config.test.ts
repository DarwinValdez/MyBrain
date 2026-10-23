import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("security headers", () => {
  it("allow the microphone for this origin only (voice capture) and keep camera/location off", async () => {
    const rules = await nextConfig.headers!();
    const policy = rules.flatMap((r) => r.headers).find((h) => h.key === "Permissions-Policy")?.value ?? "";
    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("camera=()");
    expect(policy).toContain("geolocation=()");
  });
});
