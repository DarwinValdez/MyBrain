import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProjectForm } from "@/components/projects/project-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { getProject } from "@/lib/data/projects";
import { idSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit project" };

type Params = Promise<{ id: string }>;

export default function EditProjectPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Context" title="Edit project" />
      <Card className="p-5 sm:p-6">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <EditProject params={params} />
        </Suspense>
      </Card>
    </div>
  );
}

async function EditProject({ params }: { params: Params }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const ctx = await requireUser();
  const project = await getProject(ctx, id);
  if (!project) notFound();
  return <ProjectForm project={project} />;
}
