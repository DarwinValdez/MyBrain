import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Activity, Brain, FolderKanban, Lightbulb, MessageSquare, Mic, Plus, Sparkles } from "lucide-react";
import { NeuralBackdrop } from "@/components/brand/neural-backdrop";
import { MemoryCard } from "@/components/memories/memory-card";
import { ActivityChart } from "@/components/overview/activity-chart";
import { AskBox } from "@/components/overview/ask-box";
import { ProjectCard } from "@/components/projects/project-card";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CardListSkeleton, EmptyState, Skeleton } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { listRecentMemories } from "@/lib/data/memories";
import { getActivity, getOverviewStats, getSuggestedRelated } from "@/lib/data/overview";
import { listProjects, projectMemoryCounts } from "@/lib/data/projects";
import { MEMORY_TYPE_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-deep/60 px-5 py-8 sm:px-8 sm:py-10">
        <NeuralBackdrop className="absolute inset-0 h-full w-full opacity-60" />
        <div className="relative max-w-2xl space-y-5">
          <p className="font-mono text-[11px] tracking-[0.25em] text-signal/80 uppercase">Overview</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">What do you want to remember?</h1>
          <AskBox />
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/memories/new" variant="secondary" size="sm">
              <Plus className="h-4 w-4" aria-hidden /> New memory
            </ButtonLink>
            <ButtonLink href="/voice" variant="secondary" size="sm">
              <Mic className="h-4 w-4" aria-hidden /> Voice capture
            </ButtonLink>
            <span className="self-center text-xs text-faint">
              or press <kbd className="rounded border border-line-strong px-1 font-mono">C</kbd> for quick capture
            </span>
          </div>
        </div>
      </section>

      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <Stats />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title="Recently added"
            icon={<Brain className="h-4 w-4 text-signal" aria-hidden />}
            action={
              <Link href="/memories" className="text-xs text-dim hover:text-soft">
                View all
              </Link>
            }
          />
          <div className="p-4">
            <Suspense fallback={<CardListSkeleton rows={3} />}>
              <RecentMemories />
            </Suspense>
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Knowledge activity · 30 days" icon={<Activity className="h-4 w-4 text-signal" aria-hidden />} />
            <div className="p-4">
              <Suspense fallback={<Skeleton className="h-28 w-full" />}>
                <ActivityPanel />
              </Suspense>
            </div>
          </Card>
          <Card>
            <CardHeader title="Suggested related" icon={<Lightbulb className="h-4 w-4 text-pulse" aria-hidden />} />
            <div className="p-4">
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <SuggestedRelated />
              </Suspense>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Recent projects"
          icon={<FolderKanban className="h-4 w-4 text-pulse" aria-hidden />}
          action={
            <Link href="/projects" className="text-xs text-dim hover:text-soft">
              View all
            </Link>
          }
        />
        <div className="p-4">
          <Suspense fallback={<CardListSkeleton rows={2} />}>
            <RecentProjects />
          </Suspense>
        </div>
      </Card>
    </div>
  );
}

async function Stats() {
  const ctx = await requireUser();
  const stats = await getOverviewStats(ctx);
  const items = [
    { label: "Memories", value: stats.memories, icon: Brain },
    { label: "Indexed for search", value: stats.indexed, icon: Sparkles },
    { label: "Projects", value: stats.projects, icon: FolderKanban },
    { label: "Conversations", value: stats.conversations, icon: MessageSquare },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-xl border border-line bg-panel/50 p-4">
          <dt className="flex items-center gap-2 text-xs text-dim">
            <Icon className="h-3.5 w-3.5 text-faint" aria-hidden />
            {label}
          </dt>
          <dd className="mt-2 font-mono text-2xl text-fg tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

async function RecentMemories() {
  const ctx = await requireUser();
  const [memories, projects] = await Promise.all([listRecentMemories(ctx, 5), listProjects(ctx)]);
  const names = new Map(projects.map((p) => [p.id, p.name]));
  if (!memories.length) {
    return (
      <EmptyState
        icon={<Brain className="h-5 w-5" />}
        title="Start your second brain"
        description="Capture an idea, a decision you made, or something you learned today. NEXUS indexes it so you can ask about it later."
        action={
          <ButtonLink href="/memories/new" size="sm">
            <Plus className="h-4 w-4" aria-hidden /> First memory
          </ButtonLink>
        }
        className="border-0 py-8"
      />
    );
  }
  return (
    <div className="space-y-3">
      {memories.map((m) => (
        <MemoryCard key={m.id} memory={m} projectName={m.project_id ? names.get(m.project_id) : undefined} />
      ))}
    </div>
  );
}

async function ActivityPanel() {
  const ctx = await requireUser();
  const days = await getActivity(ctx, 30);
  return <ActivityChart days={days} />;
}

async function SuggestedRelated() {
  const ctx = await requireUser();
  const suggested = await getSuggestedRelated(ctx).catch(() => null);
  if (!suggested || suggested.similar.length === 0) {
    return (
      <p className="text-sm text-dim">
        Once you have a few indexed memories, NEXUS will point out ones that look semantically related. These are suggestions, not
        confirmed links.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-dim">
        Similar to <Link href={`/memories/${suggested.source.id}`} className="text-soft hover:text-signal">{suggested.source.title}</Link>:
      </p>
      <ul className="space-y-1.5">
        {suggested.similar.map((s) => (
          <li key={s.memory_id} className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-pulse">{Math.round(s.similarity * 100)}%</span>
            <Link href={`/memories/${s.memory_id}`} className="min-w-0 truncate text-soft hover:text-signal">
              {s.title}
            </Link>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{MEMORY_TYPE_LABELS[s.type]}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-faint">Similarity is not evidence of a real connection.</p>
    </div>
  );
}

async function RecentProjects() {
  const ctx = await requireUser();
  const [projects, counts] = await Promise.all([listProjects(ctx), projectMemoryCounts(ctx)]);
  if (!projects.length) {
    return (
      <EmptyState
        icon={<FolderKanban className="h-5 w-5" />}
        title="No projects yet"
        description="Projects group memories and let you ask the AI about one context at a time."
        action={
          <ButtonLink href="/projects/new" size="sm" variant="secondary">
            <Plus className="h-4 w-4" aria-hidden /> New project
          </ButtonLink>
        }
        className="border-0 py-8"
      />
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {projects.slice(0, 4).map((p) => (
        <ProjectCard key={p.id} project={p} memoryCount={counts.get(p.id) ?? 0} />
      ))}
    </div>
  );
}
