/**
 * Split memory text into overlapping chunks of roughly `targetSize`
 * characters, preferring paragraph, then sentence, then word boundaries.
 */
export type Chunk = { index: number; content: string };

export const CHUNK_TARGET = 1200;
export const CHUNK_MAX = 1800;
export const CHUNK_OVERLAP = 200;

export function chunkText(text: string, targetSize = CHUNK_TARGET, maxSize = CHUNK_MAX, overlap = CHUNK_OVERLAP): Chunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxSize) return [{ index: 0, content: normalized }];

  const pieces = splitToPieces(normalized, targetSize);
  const chunks: string[] = [];
  let current = "";

  for (const piece of pieces) {
    if (!current) {
      current = piece;
    } else if (current.length + piece.length + 1 <= targetSize) {
      current = `${current}\n${piece}`;
    } else {
      chunks.push(current);
      const tail = overlapTail(current, overlap);
      current = tail ? `${tail} ${piece}` : piece;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((content, index) => ({ index, content: content.trim() }));
}

/** Break text into pieces no longer than `limit`, at the best boundary available. */
function splitToPieces(text: string, limit: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.length <= limit) {
      out.push(trimmed);
      continue;
    }
    const sentences = trimmed.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g) ?? [trimmed];
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      if (s.length <= limit) {
        out.push(s);
      } else {
        out.push(...hardWrap(s, limit));
      }
    }
  }
  return out;
}

function hardWrap(text: string, limit: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (word.length > limit) {
      if (line) out.push(line);
      line = "";
      for (let i = 0; i < word.length; i += limit) out.push(word.slice(i, i + limit));
      continue;
    }
    if (line && line.length + word.length + 1 > limit) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out;
}

function overlapTail(text: string, overlap: number): string {
  if (overlap <= 0 || text.length <= overlap) return "";
  const tail = text.slice(-overlap);
  const firstSpace = tail.indexOf(" ");
  return firstSpace >= 0 ? tail.slice(firstSpace + 1) : tail;
}

/** Text that is embedded for a chunk: the title gives short chunks context. */
export function embeddingInput(title: string, chunk: string): string {
  return `${title}\n\n${chunk}`;
}
