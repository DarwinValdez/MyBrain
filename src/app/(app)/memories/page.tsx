import type { Metadata } from "next";
import { Suspense } from "react";
import { Brain, Plus, SearchX } from "lucide-react";
import { MemoryCard } from "@/components/memories/memory-card";
import { MemoryFilters } from "@/components/memories/memory-filters";
import { Pagination } from "@/components/memories/pagination";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CardListSkeleton, EmptyState, Skeleton } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { listMemories, listTags } from "@/lib/data/memories";
import { listProjects } from "@/lib/data/projects";
import { pluralize } from "@/lib/format";
import { memoryFiltersSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "My Memories" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function MemoriesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Archive"
        title="My Memories"
        description="Everything you've saved. Search, filter, and open any memory to edit or connect it."
        actions={
          <ButtonLink href="/memories/new">
            <Plus className="h-4 w-4" aria-hidden /> New memory
          </ButtonLink>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <CardListSkeleton rows={6} />
          </div>
        }
      >
        <MemoryResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function MemoryResults({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireUser();
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const filters = memoryFiltersSchema.parse(flat);

  const [result, projects, tags] = await Promise.all([listMemories(ctx, filters), listProjects(ctx), listTags(ctx)]);
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const filtered = Boolean(filters.q || filters.type || filters.tag || filters.project);

  return (
    <div className="space-y-4">
      <MemoryFilters projects={projects.map((p) => ({ id: p.id, name: p.name }))} tags={tags} />
      <p className="text-xs text-dim" aria-live="polite">
        {pluralize(result.total, "memory", "memories")}
        {filtered ? " match these filters" : ""}
      </p>
      {result.items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title="No memories match"
            description="Try a different search term or clear the filters."
            action={
              <ButtonLink href="/memories" variant="secondary" size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={<Brain className="h-5 w-5" />}
            title="Your archive is empty"
            description="Save your first idea, note, or decision. Press C anywhere for quick capture."
            action={
              <ButtonLink href="/memories/new" size="sm">
                <Plus className="h-4 w-4" aria-hidden /> New memory
              </ButtonLink>
            }
          />
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {result.items.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              projectName={memory.project_id ? projectNames.get(memory.project_id) : undefined}
              dateField={filters.sort === "updated" ? "updated_at" : "created_at"}
            />
          ))}
        </div>
      )}
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        params={{
          q: filters.q,
          type: filters.type,
          tag: filters.tag,
          project: filters.project,
          sort: filters.sort === "created" ? undefined : filters.sort,
          order: filters.order === "desc" ? undefined : filters.order,
        }}
      />
    </div>
  );
}
