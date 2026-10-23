import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  params,
}: {
  page: number;
  pageCount: number;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "page") search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return `/memories${qs ? `?${qs}` : ""}`;
  };

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClasses("secondary", "sm")} rel="prev">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-xs text-dim">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={buttonClasses("secondary", "sm")} rel="next">
          Next <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
