import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { ProjectStatusBadge } from "@/components/projects/project-status";
import type { Project } from "@/lib/database.types";
import { excerpt, formatDate, pluralize } from "@/lib/format";

export function ProjectCard({ project, memoryCount }: { project: Project; memoryCount: number }) {
  return (
    <article className="relative rounded-xl border border-line bg-panel/50 p-4 transition-colors hover:border-pulse/30 hover:bg-panel/80">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-pulse/25 bg-pulse-deep/30 text-pulse">
          <FolderKanban className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">
            <Link href={`/projects/${project.id}`} className="after:absolute after:inset-0">
              {project.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-faint">
            {pluralize(memoryCount, "memory", "memories")} · updated {formatDate(project.updated_at)}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      {project.description ? <p className="mt-3 line-clamp-2 text-sm text-dim">{excerpt(project.description, 200)}</p> : null}
    </article>
  );
}
