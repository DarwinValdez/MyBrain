import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MemoryForm } from "@/components/memories/memory-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { getMemory } from "@/lib/data/memories";
import { listProjects } from "@/lib/data/projects";
import { idSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit memory" };

type Params = Promise<{ id: string }>;

export default function EditMemoryPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Edit" title="Edit memory" description="Changing the text re-indexes the memory for semantic search." />
      <Card className="p-5 sm:p-6">
        <Suspense fallback={<Skeleton className="h-[480px] w-full" />}>
          <EditForm params={params} />
        </Suspense>
      </Card>
    </div>
  );
}

async function EditForm({ params }: { params: Params }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const ctx = await requireUser();
  const [memory, projects] = await Promise.all([getMemory(ctx, id), listProjects(ctx)]);
  if (!memory) notFound();
  return <MemoryForm memory={memory} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />;
}
