import Link from "next/link";
import { TypeBadge } from "@/components/memories/type-badge";
import type { Citation } from "@/lib/ai/citations";
import { formatDate } from "@/lib/format";

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase">Sources from your memories</p>
      <ol className="grid gap-2 sm:grid-cols-2">
        {citations.map((citation) => (
          <li key={citation.index}>
            <Link
              href={`/memories/${citation.memoryId}`}
              className="block h-full rounded-lg border border-line bg-abyss/60 p-3 transition-colors hover:border-signal/30"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-signal">[{citation.index}]</span>
                <span className="min-w-0 truncate text-sm font-medium text-fg">{citation.title}</span>
              </div>
              {citation.excerpt ? <p className="mt-1 line-clamp-2 text-xs text-dim">{citation.excerpt}</p> : null}
              <div className="mt-2 flex items-center gap-2">
                <TypeBadge type={citation.type} />
                <span className="text-[11px] text-faint">Saved {formatDate(citation.createdAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
