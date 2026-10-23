import type { Metadata } from "next";
import { ProjectForm } from "@/components/projects/project-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Context" title="New project" />
      <Card className="p-5 sm:p-6">
        <ProjectForm />
      </Card>
    </div>
  );
}
