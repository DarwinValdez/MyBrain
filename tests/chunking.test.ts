import { describe, expect, it } from "vitest";
import { CHUNK_MAX, chunkText, embeddingInput } from "@/lib/ai/chunking";

describe("chunkText", () => {
  it("returns nothing for empty text", () => {
    expect(chunkText("   \n ")).toEqual([]);
  });

  it("keeps short text as one chunk", () => {
    expect(chunkText("A short note.")).toEqual([{ index: 0, content: "A short note." }]);
  });

  it("splits long text into bounded, ordered chunks", () => {
    const paragraph = "This is a sentence about knowledge systems. ".repeat(20);
    const text = Array.from({ length: 8 }, () => paragraph).join("\n\n");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(2);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_MAX);
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });

  it("hard-wraps text with no natural boundaries", () => {
    const chunks = chunkText("x".repeat(5000));
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_MAX);
  });

  it("overlaps consecutive chunks so context isn't lost at boundaries", () => {
    const words = Array.from({ length: 900 }, (_, i) => `word${i}`).join(" ");
    const [first, second] = chunkText(words);
    const tail = first.content.split(" ").slice(-3).join(" ");
    expect(second.content.startsWith(tail) || second.content.includes(tail)).toBe(true);
  });

  it("prefixes the title for embedding", () => {
    expect(embeddingInput("Title", "body")).toBe("Title\n\nbody");
  });
});
