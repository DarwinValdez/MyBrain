import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import { getAiConfig } from "@/lib/ai/config";
import { requireUser } from "@/lib/auth";
import { listProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Voice capture" };
// Server actions on this page index memories and may call the AI provider.
export const maxDuration = 60;

export default function VoicePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Capture"
        title="Voice capture"
        description="Talk instead of typing. NEXUS transcribes as you speak, saves the transcript as you go, and can pull out the key ideas, decisions and tasks as separate memories."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Voice />
      </Suspense>
    </div>
  );
}

async function Voice() {
  const ctx = await requireUser();
  const projects = await listProjects(ctx);
  return <VoiceRecorder projects={projects.map((p) => ({ id: p.id, name: p.name }))} aiConfigured={Boolean(getAiConfig().generation)} />;
}
