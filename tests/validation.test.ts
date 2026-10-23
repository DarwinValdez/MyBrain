import { describe, expect, it } from "vitest";
import {
  deriveTitle,
  memoryFiltersSchema,
  memoryInputSchema,
  normalizeTags,
  projectInputSchema,
  quickCaptureSchema,
  recallRequestSchema,
  relationshipInputSchema,
} from "@/lib/validation";

describe("memoryInputSchema", () => {
  it("accepts a valid memory and normalises optional fields", () => {
    const result = memoryInputSchema.parse({
      title: "  Pricing decision ",
      content: "We chose usage-based pricing.",
      type: "decision",
      tags: "Pricing, #Strategy, pricing,  go to market ",
      projectId: "",
      sourceUrl: "",
    });
    expect(result).toMatchObject({
      title: "Pricing decision",
      type: "decision",
      tags: ["pricing", "strategy", "go-to-market"],
      projectId: null,
      sourceUrl: null,
      sourceNotes: "",
    });
  });

  it("rejects a missing title", () => {
    expect(memoryInputSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("rejects unknown memory types", () => {
    expect(memoryInputSchema.safeParse({ title: "x", type: "secret" }).success).toBe(false);
  });

  it("rejects non-http source URLs (no javascript: links)", () => {
    expect(memoryInputSchema.safeParse({ title: "x", sourceUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(memoryInputSchema.safeParse({ title: "x", sourceUrl: "ftp://example.com" }).success).toBe(false);
    expect(memoryInputSchema.parse({ title: "x", sourceUrl: "https://example.com/a" }).sourceUrl).toBe("https://example.com/a");
  });

  it("rejects malformed project ids", () => {
    expect(memoryInputSchema.safeParse({ title: "x", projectId: "1; drop table" }).success).toBe(false);
  });

  it("limits content length and tag count", () => {
    expect(memoryInputSchema.safeParse({ title: "x", content: "a".repeat(50_001) }).success).toBe(false);
    const manyTags = Array.from({ length: 21 }, (_, i) => `t${i}`).join(",");
    expect(memoryInputSchema.safeParse({ title: "x", tags: manyTags }).success).toBe(false);
  });
});

describe("normalizeTags", () => {
  it("strips punctuation and HTML-ish characters", () => {
    expect(normalizeTags("<b>bold</b>, a&b")).toEqual(["bboldb", "ab"]);
  });
});

describe("quickCaptureSchema", () => {
  it("derives a title from the first line", () => {
    const parsed = quickCaptureSchema.parse({ content: "Call Ana about the launch\nmore details" });
    expect(parsed.title).toBe("Call Ana about the launch");
  });

  it("truncates long derived titles", () => {
    expect(deriveTitle("x".repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it("requires content", () => {
    expect(quickCaptureSchema.safeParse({ content: "  " }).success).toBe(false);
  });
});

describe("projectInputSchema", () => {
  it("defaults status to active", () => {
    expect(projectInputSchema.parse({ name: "Thesis" }).status).toBe("active");
  });
  it("rejects invalid status", () => {
    expect(projectInputSchema.safeParse({ name: "Thesis", status: "deleted" }).success).toBe(false);
  });
});

describe("memoryFiltersSchema", () => {
  it("falls back to safe defaults for garbage input", () => {
    expect(memoryFiltersSchema.parse({ page: "-4", sort: "evil", order: "sideways", type: "nope", project: "x" })).toEqual({
      q: undefined,
      type: undefined,
      tag: undefined,
      project: undefined,
      sort: "created",
      order: "desc",
      page: 1,
    });
  });
  it("accepts valid filters", () => {
    const id = "6f1c2c1e-2b4a-4c55-9d43-0d4b4f1c9a10";
    expect(memoryFiltersSchema.parse({ page: "3", sort: "updated", order: "asc", type: "idea", project: id, tag: "AI" })).toMatchObject({
      page: 3,
      sort: "updated",
      order: "asc",
      type: "idea",
      project: id,
      tag: "ai",
    });
  });
});

describe("recallRequestSchema", () => {
  it("requires a question and validates ids", () => {
    expect(recallRequestSchema.safeParse({ question: "" }).success).toBe(false);
    expect(recallRequestSchema.safeParse({ question: "hi", projectId: "not-a-uuid" }).success).toBe(false);
    expect(recallRequestSchema.safeParse({ question: "x".repeat(4001) }).success).toBe(false);
    expect(recallRequestSchema.parse({ question: " What did I decide? " }).question).toBe("What did I decide?");
  });
});

describe("relationshipInputSchema", () => {
  it("rejects self-links", () => {
    const id = "6f1c2c1e-2b4a-4c55-9d43-0d4b4f1c9a10";
    expect(relationshipInputSchema.safeParse({ sourceMemoryId: id, targetMemoryId: id }).success).toBe(false);
  });
});
