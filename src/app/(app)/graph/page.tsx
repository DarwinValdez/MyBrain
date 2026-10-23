import type { Metadata } from "next";
import { Suspense } from "react";
import { Network, Plus } from "lucide-react";
import { GraphView } from "@/components/graph/graph-view";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { getGraphData } from "@/lib/data/graph";

export const metadata: Metadata = { title: "Knowledge Graph" };

export default function GraphPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Structure"
        title="Knowledge Graph"
        description="Memories, projects and concepts, linked by project membership, shared tags and the connections you've confirmed."
      />
      <Suspense fallback={<Skeleton className="h-[62vh] w-full" />}>
        <Graph />
      </Suspense>
    </div>
  );
}

async function Graph() {
  const ctx = await requireUser();
  const data = await getGraphData(ctx);
  if (data.memories.length === 0) {
    return (
      <EmptyState
        icon={<Network className="h-5 w-5" />}
        title="Nothing to map yet"
        description="Save a few memories with tags or projects and they'll appear here as a network."
        action={
          <ButtonLink href="/memories/new" size="sm">
            <Plus className="h-4 w-4" aria-hidden /> New memory
          </ButtonLink>
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {data.truncated ? <p className="text-xs text-warn">Showing your 300 most recently edited memories.</p> : null}
      <GraphView data={data} />
    </div>
  );
}
