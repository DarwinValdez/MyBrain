import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Brain, Pencil, Plus, Sparkles } from "lucide-react";
import { IndexStatusDot } from "@/components/memories/index-status";
import { TypeBadge } from "@/components/memories/type-badge";
import { DeleteProjectButton, RemoveFromProjectButton } from "@/components/projects/project-actions";
import { ProjectStatusBadge } from "@/components/projects/project-status";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CardListSkeleton, EmptyState, Skeleton } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { listProjectMemories } from "@/lib/data/memories";
import { getProject } from "@/lib/data/projects";
import { excerpt, formatDate, pluralize } from "@/lib/format";
import { idSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Project" };

type Params = Promise<{ id: string }>;

export default function ProjectPage({ params }: { params: Params }) {
  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-dim hover:text-soft">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Projects
      </Link>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/2" />
            <CardListSkeleton rows={4} />
          </div>
        }
      >
        <ProjectDetail params={params} />
      </Suspense>
    </div>
  );
}

async function ProjectDetail({ params }: { params: Params }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const ctx = await requireUser();
  const [project, memories] = await Promise.all([getProject(ctx, id), listProjectMemories(ctx, id)]);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
          <span className="text-xs text-faint">
            Created {formatDate(project.created_at)} · updated {formatDate(project.updated_at)}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{project.name}</h1>
        {project.description ? <p className="max-w-3xl whitespace-pre-wrap text-soft">{project.description}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <ButtonLink href={`/recall?project=${project.id}`}>
            <Sparkles className="h-4 w-4" aria-hidden /> Ask about this project
          </ButtonLink>
          <ButtonLink href={`/memories/new?project=${project.id}`} variant="secondary">
            <Plus className="h-4 w-4" aria-hidden /> Add memory
          </ButtonLink>
          <ButtonLink href={`/projects/${project.id}/edit`} variant="ghost">
            <Pencil className="h-4 w-4" aria-hidden /> Edit
          </ButtonLink>
          <DeleteProjectButton id={project.id} name={project.name} />
        </div>
      </header>

      {project.goals || project.next_steps ? (
        <div className="grid gap-4 md:grid-cols-2">
          {project.goals ? (
            <Card>
              <CardHeader title="Goals" />
              <p className="px-5 py-4 text-sm whitespace-pre-wrap text-soft">{project.goals}</p>
            </Card>
          ) : null}
          {project.next_steps ? (
            <Card>
              <CardHeader title="Next steps" />
              <p className="px-5 py-4 text-sm whitespace-pre-wrap text-soft">{project.next_steps}</p>
            </Card>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-soft">
          Timeline · {pluralize(memories.length, "memory", "memories")}, oldest first
        </h2>
        {memories.length === 0 ? (
          <EmptyState
            icon={<Brain className="h-5 w-5" />}
            title="No memories in this project"
            description="Add a memory here, or assign existing memories to this project from their detail page."
            action={
              <ButtonLink href={`/memories/new?project=${project.id}`} size="sm">
                <Plus className="h-4 w-4" aria-hidden /> Add memory
              </ButtonLink>
            }
          />
        ) : (
          <ol className="relative space-y-3 border-l border-line pl-5">
            {memories.map((memory) => (
              <li key={memory.id} className="relative">
                <span className="absolute top-4 -left-[25px] h-2 w-2 rounded-full border border-signal/60 bg-abyss" aria-hidden />
                <article className="relative rounded-xl border border-line bg-panel/50 p-4 transition-colors hover:border-signal/30">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <time className="font-mono text-[11px] text-faint" dateTime={memory.created_at}>
                        {formatDate(memory.created_at)}
                      </time>
                      <h3 className="mt-0.5 text-sm font-medium">
                        <Link href={`/memories/${memory.id}`} className="after:absolute after:inset-0">
                          {memory.title}
                        </Link>
                      </h3>
                      {memory.content ? <p className="mt-1 line-clamp-2 text-sm text-dim">{excerpt(memory.content, 200)}</p> : null}
                      <div className="mt-2 flex items-center gap-3">
                        <TypeBadge type={memory.type} />
                        <IndexStatusDot status={memory.index_status} />
                      </div>
                    </div>
                    <RemoveFromProjectButton memoryId={memory.id} title={memory.title} />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
