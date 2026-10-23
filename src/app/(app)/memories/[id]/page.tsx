import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink, Pencil, Sparkles } from "lucide-react";
import { DeleteMemoryButton, ReindexButton } from "@/components/memories/memory-actions";
import { IndexStatusDot } from "@/components/memories/index-status";
import { MemoryProjectSelect } from "@/components/memories/memory-project-select";
import { RelationshipsPanel } from "@/components/memories/relationships-panel";
import { TagList } from "@/components/memories/tag-list";
import { TypeBadge } from "@/components/memories/type-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CardListSkeleton, Skeleton } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { getMemory, listMemoryOptions, listMemoryRelationships } from "@/lib/data/memories";
import { listProjects } from "@/lib/data/projects";
import { formatDateTime } from "@/lib/format";
import { idSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Memory" };

type Params = Promise<{ id: string }>;

export default function MemoryPage({ params }: { params: Params }) {
  return (
    <div className="space-y-6">
      <Link href="/memories" className="inline-flex items-center gap-1.5 text-sm text-dim hover:text-soft">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My Memories
      </Link>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <CardListSkeleton rows={3} />
          </div>
        }
      >
        <MemoryDetail params={params} />
      </Suspense>
    </div>
  );
}

async function MemoryDetail({ params }: { params: Params }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const ctx = await requireUser();
  const memory = await getMemory(ctx, id);
  if (!memory) notFound();

  const [projects, related, options] = await Promise.all([
    listProjects(ctx),
    listMemoryRelationships(ctx, id),
    listMemoryOptions(ctx, id),
  ]);
  const project = projects.find((p) => p.id === memory.project_id);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="min-w-0 space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={memory.type} />
            {project ? (
              <Link href={`/projects/${project.id}`} className="text-xs text-pulse hover:underline">
                {project.name}
              </Link>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{memory.title}</h1>
          <TagList tags={memory.tags} />
          <div className="flex flex-wrap gap-2 pt-1">
            <ButtonLink href={`/memories/${memory.id}/edit`} variant="secondary" size="md">
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </ButtonLink>
            <ButtonLink href={`/recall?q=${encodeURIComponent(`What do I know related to "${memory.title}"?`)}`} variant="ghost">
              <Sparkles className="h-4 w-4" aria-hidden /> Ask about this
            </ButtonLink>
            <DeleteMemoryButton id={memory.id} title={memory.title} />
          </div>
        </header>

        <Card className="p-5 sm:p-6">
          {memory.content ? (
            // Rendered as text, never as HTML.
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-soft">{memory.content}</div>
          ) : (
            <p className="text-sm text-dim italic">No content — just a title.</p>
          )}
        </Card>

        {memory.source_url || memory.source_notes ? (
          <Card className="space-y-2 p-5 text-sm">
            <h2 className="text-xs font-medium tracking-wide text-soft uppercase">Source</h2>
            {memory.source_url ? (
              <a
                href={memory.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex max-w-full items-center gap-1.5 break-all text-signal hover:underline"
              >
                {memory.source_url}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </a>
            ) : null}
            {memory.source_notes ? <p className="whitespace-pre-wrap text-dim">{memory.source_notes}</p> : null}
          </Card>
        ) : null}
      </article>

      <aside className="space-y-4">
        <Card>
          <CardHeader title="Details" />
          <dl className="space-y-3 px-5 py-4 text-sm">
            <div>
              <dt className="text-xs text-faint">Created</dt>
              <dd className="text-soft">{formatDateTime(memory.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Last edited</dt>
              <dd className="text-soft">{formatDateTime(memory.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Visibility</dt>
              <dd className="text-soft">Private</dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-xs text-faint">Project</dt>
              <dd>
                <MemoryProjectSelect
                  key={memory.project_id ?? "none"}
                  memoryId={memory.id}
                  projectId={memory.project_id}
                  projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                />
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-xs text-faint">Search index</dt>
              <dd className="space-y-2">
                <IndexStatusDot status={memory.index_status} showLabel />
                {memory.index_error ? <p className="text-xs text-danger">{memory.index_error}</p> : null}
                {memory.index_status !== "indexed" ? <ReindexButton id={memory.id} /> : null}
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <RelationshipsPanel
            memoryId={memory.id}
            related={related}
            options={options}
            canSuggest={memory.index_status === "indexed"}
          />
        </Card>
      </aside>
    </div>
  );
}
