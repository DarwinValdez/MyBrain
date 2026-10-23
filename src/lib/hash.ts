import { createHash } from "node:crypto";

/** Stable fingerprint of the text that gets embedded for a memory. */
export function memoryContentHash(title: string, content: string): string {
  return createHash("sha256").update(`${title}\u0000${content}`).digest("hex");
}
