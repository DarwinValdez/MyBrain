import type { Metadata } from "next";
import { Suspense } from "react";
import { RecallChat } from "@/components/recall/recall-chat";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { getAiConfig } from "@/lib/ai/config";
import { requireUser } from "@/lib/auth";
import { getConversation, listConversations, listMessages } from "@/lib/data/conversations";
import { listProjects } from "@/lib/data/projects";
import { idSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "AI Recall" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function RecallPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Retrieval"
        title="AI Recall"
        description="Ask questions in natural language. Answers draw on your saved memories and link to every source they use."
      />
      <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
        <Recall searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Recall({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireUser();
  const params = await searchParams;
  const c = typeof params.c === "string" && idSchema.safeParse(params.c).success ? params.c : null;
  const q = typeof params.q === "string" ? params.q.slice(0, 4000) : undefined;
  const project = typeof params.project === "string" && idSchema.safeParse(params.project).success ? params.project : undefined;

  const [conversations, projects, active] = await Promise.all([
    listConversations(ctx),
    listProjects(ctx),
    c ? getConversation(ctx, c) : Promise.resolve(null),
  ]);
  const messages = active ? await listMessages(ctx, active.id) : [];
  const ai = getAiConfig();

  return (
    <RecallChat
      key={active?.id ?? `new-${q ?? ""}-${project ?? ""}`}
      conversations={conversations.map((x) => ({ id: x.id, title: x.title, projectId: x.project_id }))}
      activeConversation={active ? { id: active.id, title: active.title, projectId: active.project_id } : null}
      initialMessages={messages}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      initialQuestion={q}
      initialProjectId={projects.some((p) => p.id === project) ? project : undefined}
      aiConfigured={Boolean(ai.generation)}
    />
  );
}
