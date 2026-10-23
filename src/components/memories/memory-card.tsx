import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { IndexStatusDot } from "@/components/memories/index-status";
import { TagList } from "@/components/memories/tag-list";
import { TypeBadge } from "@/components/memories/type-badge";
import type { MemoryListItem } from "@/lib/data/memories";
import { excerpt, formatDate } from "@/lib/format";

export function MemoryCard({
  memory,
  projectName,
  dateField = "created_at",
}: {
  memory: MemoryListItem;
  projectName?: string;
  dateField?: "created_at" | "updated_at";
}) {
  return (
    <article className="group relative rounded-xl border border-line bg-panel/50 p-4 transition-colors hover:border-signal/30 hover:bg-panel/80">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-fg">
          <Link href={`/memories/${memory.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            <span className="line-clamp-2 break-words">{memory.title}</span>
          </Link>
        </h3>
        <IndexStatusDot status={memory.index_status} />
      </div>
      {memory.content ? <p className="mt-1.5 line-clamp-2 text-sm break-words text-dim">{excerpt(memory.content, 220)}</p> : null}
      <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <TypeBadge type={memory.type} />
        {projectName ? (
          <span className="inline-flex min-w-0 items-center gap-1 text-xs text-soft">
            <FolderKanban className="h-3 w-3 shrink-0 text-pulse" aria-hidden />
            <span className="truncate">{projectName}</span>
          </span>
        ) : null}
        <TagList tags={memory.tags.slice(0, 4)} linked={false} />
        <time className="ml-auto text-xs text-faint" dateTime={memory[dateField]}>
          {dateField === "updated_at" ? "Edited " : ""}
          {formatDate(memory[dateField])}
        </time>
      </div>
    </article>
  );
}
