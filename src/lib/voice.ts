/** "Voice session · …" → "Voice session · … (part 2)" → "… (part 3)" */
export function nextPartTitle(title: string): string {
  const match = title.match(/^(.*) \(part (\d+)\)$/);
  return match ? `${match[1]} (part ${Number(match[2]) + 1})` : `${title} (part 2)`;
}

/** One finalized piece of speech, with the local time it was heard. */
export type TranscriptSegment = { at: number; text: string };

/** Format segments as "[14:05:12] text" lines for storage. */
export function formatSegments(segments: TranscriptSegment[], formatTime: (at: number) => string): string {
  return segments
    .map((s) => ({ ...s, text: s.text.replace(/\s+/g, " ").trim() }))
    .filter((s) => s.text)
    .map((s) => `[${formatTime(s.at)}] ${s.text}`)
    .join("\n");
}
