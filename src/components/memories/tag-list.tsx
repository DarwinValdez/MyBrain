import Link from "next/link";
import { Hash } from "lucide-react";

export function TagList({ tags, linked = true }: { tags: string[]; linked?: boolean }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>
          {linked ? (
            <Link
              href={`/memories?tag=${encodeURIComponent(tag)}`}
              className="inline-flex items-center gap-0.5 rounded-md px-1 text-xs text-dim transition-colors hover:text-signal"
            >
              <Hash className="h-3 w-3" aria-hidden />
              {tag}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-xs text-dim">
              <Hash className="h-3 w-3" aria-hidden />
              {tag}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
