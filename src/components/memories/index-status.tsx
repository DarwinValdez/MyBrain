import type { IndexStatus } from "@/lib/database.types";
import { cn } from "@/lib/cn";

const LABELS: Record<IndexStatus, string> = {
  indexed: "Indexed for semantic search",
  pending: "Waiting to be indexed",
  failed: "Indexing failed",
};

export function IndexStatusDot({ status, showLabel = false }: { status: IndexStatus; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-dim" title={LABELS[status]}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "indexed" && "bg-signal",
          status === "pending" && "animate-pulse-soft bg-warn",
          status === "failed" && "bg-danger",
        )}
        aria-hidden
      />
      {showLabel ? LABELS[status] : <span className="sr-only">{LABELS[status]}</span>}
    </span>
  );
}
