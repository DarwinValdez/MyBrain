"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { MEMORY_TYPES, MEMORY_TYPE_LABELS } from "@/lib/constants";

type Props = {
  projects: { id: string; name: string }[];
  tags: { tag: string; count: number }[];
};

/** GET form: works without JavaScript; selects auto-apply when JS is available. */
export function MemoryFilters({ projects, tags }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const hasFilters = ["q", "type", "tag", "project"].some((key) => params.get(key));
  const sortValue = `${params.get("sort") ?? "created"}:${params.get("order") ?? "desc"}`;

  return (
    <form
      action="/memories"
      method="get"
      className="grid gap-2 rounded-xl border border-line bg-panel/40 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]"
      onChange={(event) => {
        if ((event.target as HTMLElement).tagName === "SELECT") event.currentTarget.requestSubmit();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const next = new URLSearchParams();
        for (const [key, value] of data.entries()) {
          if (typeof value !== "string" || !value) continue;
          if (key === "sortorder") {
            const [sort, order] = value.split(":");
            if (sort !== "created") next.set("sort", sort);
            if (order !== "desc") next.set("order", order);
          } else next.set(key, value);
        }
        router.push(`/memories${next.size ? `?${next}` : ""}`);
      }}
    >
      <label className="relative sm:col-span-2 lg:col-span-1">
        <span className="sr-only">Search memories</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
        <Input name="q" defaultValue={params.get("q") ?? ""} placeholder="Search titles and content…" className="pl-9" />
      </label>
      <Select name="type" defaultValue={params.get("type") ?? ""} aria-label="Filter by type">
        <option value="">All types</option>
        {MEMORY_TYPES.map((type) => (
          <option key={type} value={type}>
            {MEMORY_TYPE_LABELS[type]}
          </option>
        ))}
      </Select>
      <Select name="project" defaultValue={params.get("project") ?? ""} aria-label="Filter by project">
        <option value="">All projects</option>
        <option value="none">No project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </Select>
      <Select name="tag" defaultValue={params.get("tag") ?? ""} aria-label="Filter by tag">
        <option value="">All tags</option>
        {tags.map(({ tag, count }) => (
          <option key={tag} value={tag}>
            #{tag} ({count})
          </option>
        ))}
      </Select>
      <Select name="sortorder" defaultValue={sortValue} aria-label="Sort">
        <option value="created:desc">Newest first</option>
        <option value="created:asc">Oldest first</option>
        <option value="updated:desc">Recently edited</option>
        <option value="updated:asc">Least recently edited</option>
      </Select>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/memories")}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </Button>
        ) : null}
      </div>
    </form>
  );
}
