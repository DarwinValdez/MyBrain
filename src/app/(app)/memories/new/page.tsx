import type { Metadata } from "next";
import { Suspense } from "react";
import { MemoryForm } from "@/components/memories/memory-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { listProjects } from "@/lib/data/projects";
import { idSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "New memory" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function NewMemoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Capture" title="New memory" description="Saved privately. Indexed for semantic search when you save." />
      <Card className="p-5 sm:p-6">
        <Suspense fallback={<Skeleton className="h-[480px] w-full" />}>
          <NewMemoryForm searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

async function NewMemoryForm({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireUser();
  const { project } = await searchParams;
  const projects = await listProjects(ctx);
  const requested = typeof project === "string" && idSchema.safeParse(project).success ? project : undefined;
  const defaultProjectId = projects.some((p) => p.id === requested) ? requested : undefined;
  return <MemoryForm projects={projects.map((p) => ({ id: p.id, name: p.name }))} defaultProjectId={defaultProjectId} />;
}
