import { describe, expect, it } from "vitest";
import { extractCitations, segmentAnswer } from "@/lib/ai/citations";
import type { ContextItem } from "@/lib/ai/retrieval";

function item(index: number, memoryId: string, title: string): ContextItem {
  return {
    index,
    memoryId,
    title,
    type: "note",
    tags: [],
    projectId: null,
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
    excerpt: `Excerpt for ${title}`,
    score: 1,
    similarity: 0.8,
    matchedBy: ["semantic"],
  };
}

const items = [item(1, "m-1", "Pricing"), item(2, "m-2", "Launch"), item(3, "m-3", "Unused")];

describe("extractCitations", () => {
  it("maps markers to the memories that were provided, in order of first use", () => {
    const { text, citations } = extractCitations("You chose usage pricing [2]. It launched in May [1][2].", items);
    expect(text).toBe("You chose usage pricing [2]. It launched in May [1][2].");
    expect(citations.map((c) => c.memoryId)).toEqual(["m-2", "m-1"]);
    expect(citations[0]).toMatchObject({ index: 2, title: "Launch", excerpt: "Excerpt for Launch" });
  });

  it("drops markers that don't correspond to a provided memory (no invented sources)", () => {
    const { text, citations } = extractCitations("Claim [7]. Other [1, 9].", items);
    expect(text).toBe("Claim . Other [1].");
    expect(citations.map((c) => c.index)).toEqual([1]);
  });

  it("returns no citations when the model cited nothing", () => {
    expect(extractCitations("I don't have enough saved information.", items).citations).toEqual([]);
  });

  it("expands grouped markers", () => {
    expect(extractCitations("See [1, 3].", items).text).toBe("See [1][3].");
  });
});

describe("segmentAnswer", () => {
  it("splits text and citation references", () => {
    expect(segmentAnswer("A [1] b [2]")).toEqual([
      { kind: "text", text: "A " },
      { kind: "cite", index: 1 },
      { kind: "text", text: " b " },
      { kind: "cite", index: 2 },
    ]);
  });
});
