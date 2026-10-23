import type { ContextItem } from "@/lib/ai/retrieval";

export type Citation = {
  /** The [n] number used in the answer text. */
  index: number;
  memoryId: string;
  title: string;
  type: ContextItem["type"];
  excerpt: string;
  createdAt: string;
};

const MARKER = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/**
 * Find the [n] markers the model used, keep only those that refer to memories
 * that were actually provided, and drop any others from the text so the answer
 * never points at a memory that doesn't exist.
 */
export function extractCitations(answer: string, items: ContextItem[]): { text: string; citations: Citation[] } {
  const byIndex = new Map(items.map((item) => [item.index, item]));
  const used: number[] = [];

  const text = answer.replace(MARKER, (_match, group: string) => {
    const valid = group
      .split(",")
      .map((n) => Number.parseInt(n.trim(), 10))
      .filter((n) => byIndex.has(n));
    for (const n of valid) if (!used.includes(n)) used.push(n);
    return valid.map((n) => `[${n}]`).join("");
  });

  const citations = used.map((n) => {
    const item = byIndex.get(n)!;
    return {
      index: n,
      memoryId: item.memoryId,
      title: item.title,
      type: item.type,
      excerpt: excerptFor(item.excerpt),
      createdAt: item.createdAt,
    };
  });

  return { text: text.replace(/[ \t]+\n/g, "\n").trim(), citations };
}

function excerptFor(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Split answer text into plain segments and citation references for rendering. */
export type AnswerSegment = { kind: "text"; text: string } | { kind: "cite"; index: number };

export function segmentAnswer(text: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: "text", text: text.slice(last, start) });
    segments.push({ kind: "cite", index: Number(match[1]) });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}
