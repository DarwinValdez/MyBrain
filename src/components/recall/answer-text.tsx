import Link from "next/link";
import { Fragment } from "react";
import { segmentAnswer, type Citation } from "@/lib/ai/citations";

/**
 * Render a model answer as plain text: paragraphs, "- " bullets, and [n]
 * citation chips. No HTML or Markdown is interpreted.
 */
export function AnswerText({ text, citations }: { text: string; citations: Citation[] }) {
  const byIndex = new Map(citations.map((c) => [c.index, c]));
  const blocks = text.split(/\n{2,}/);

  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-soft">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((line) => /^\s*[-*•]\s+/.test(line));
        if (isList) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-signal/60">
              {lines.map((line, j) => (
                <li key={j}>
                  <Inline text={line.replace(/^\s*[-*•]\s+/, "")} byIndex={byIndex} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            <Inline text={block} byIndex={byIndex} />
          </p>
        );
      })}
    </div>
  );
}

function Inline({ text, byIndex }: { text: string; byIndex: Map<number, Citation> }) {
  return (
    <>
      {segmentAnswer(text).map((segment, i) => {
        if (segment.kind === "text") return <Fragment key={i}>{segment.text}</Fragment>;
        const citation = byIndex.get(segment.index);
        if (!citation) return null;
        return (
          <Link
            key={i}
            href={`/memories/${citation.memoryId}`}
            title={citation.title}
            className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded border border-signal/30 bg-signal-deep/40 px-1 align-middle font-mono text-[10px] text-signal-strong no-underline hover:bg-signal-deep/70"
          >
            {segment.index}
          </Link>
        );
      })}
    </>
  );
}
