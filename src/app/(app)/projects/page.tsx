import type { Metadata } from "next";
import { Suspense } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { ProjectCard } from "@/components/projects/project-card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CardListSkeleton, EmptyState } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { listProjects, projectMemoryCounts } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Context"
        title="Projects"
        description="Group memories by what you're working on, then ask the AI about one project at a time."
        actions={
          <ButtonLink href="/projects/new">
            <Plus className="h-4 w-4" aria-hidden /> New project
          </ButtonLink>
        }
      />
      <Suspense fallback={<CardListSkeleton rows={4} />}>
        <ProjectList />
      </Suspense>
    </div>
  );
}

async function ProjectList() {
  const ctx = await requireUser();
  const [projects, counts] = await Promise.all([listProjects(ctx), projectMemoryCounts(ctx)]);
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<FolderKanban className="h-5 w-5" />}
        title="No projects yet"
        description="Create a project to collect related memories, track goals and next steps, and scope AI questions."
        action={
          <ButtonLink href="/projects/new" size="sm">
            <Plus className="h-4 w-4" aria-hidden /> New project
          </ButtonLink>
        }
      />
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} memoryCount={counts.get(project.id) ?? 0} />
      ))}
    </div>
  );
}
