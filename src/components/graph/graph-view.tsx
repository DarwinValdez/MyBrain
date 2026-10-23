"use client";

import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Check, ExternalLink, FolderKanban, Hash, X } from "lucide-react";
import { reviewSuggestionAction } from "@/app/actions/relationships";
import { TYPE_ICONS } from "@/components/memories/type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { MEMORY_TYPES, MEMORY_TYPE_LABELS } from "@/lib/constants";
import type { GraphData } from "@/lib/data/graph";
import type { MemoryType } from "@/lib/database.types";
import { buildGraph, layoutGraph, type GraphNodeData } from "@/lib/graph";

type FlowNode = Node<GraphNodeData>;

function NexusNode({ data, selected }: NodeProps<FlowNode>) {
  const Icon = data.kind === "memory" && data.memoryType ? TYPE_ICONS[data.memoryType] : data.kind === "project" ? FolderKanban : Hash;
  return (
    <div
      className={cn(
        "flex max-w-[200px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] shadow-lg shadow-black/40 backdrop-blur",
        data.kind === "memory" && "border-signal/35 bg-deep/90 text-soft",
        data.kind === "project" && "border-pulse/50 bg-pulse-deep/70 px-3 py-1.5 text-xs font-medium text-fg",
        data.kind === "tag" && "border-line-strong bg-abyss/90 text-dim",
        selected && "ring-2 ring-signal/70",
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Icon className={cn("h-3 w-3 shrink-0", data.kind === "project" ? "text-pulse" : data.kind === "memory" ? "text-signal" : "text-faint")} aria-hidden />
      <span className="truncate">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}

const nodeTypes = { nexus: NexusNode };

export function GraphView({ data }: { data: GraphData }) {
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState<MemoryType | "">("");
  const [showTags, setShowTags] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const graph = useMemo(
    () =>
      buildGraph(data, {
        projectId: projectId || null,
        types: type ? new Set([type]) : null,
        showTags,
        showSuggestions,
      }),
    [data, projectId, type, showTags, showSuggestions],
  );

  const { nodes, edges } = useMemo(() => {
    const positions = layoutGraph(graph);
    const flowNodes: FlowNode[] = graph.nodes.map((node) => ({
      id: node.id,
      type: "nexus",
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: node.data,
    }));
    const flowEdges: Edge[] = graph.edges.map((edge) => {
      const suggested = edge.data.status === "suggested";
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.data.label,
        animated: suggested,
        style: {
          stroke:
            edge.data.kind === "relationship" ? (suggested ? "#a594f9" : "#5fd4c8") : edge.data.kind === "project" ? "rgb(165 148 249 / 0.35)" : "rgb(148 163 184 / 0.22)",
          strokeWidth: edge.data.kind === "relationship" ? 1.6 : 1,
          strokeDasharray: suggested ? "5 4" : edge.data.kind === "tag" ? "2 3" : undefined,
        },
      };
    });
    return { nodes: flowNodes, edges: flowEdges };
  }, [graph]);

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;
  const neighbours = useMemo(() => {
    if (!selected) return [];
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    return graph.edges
      .filter((e) => e.source === selected.id || e.target === selected.id)
      .map((e) => ({ edge: e, node: byId.get(e.source === selected.id ? e.target : e.source)! }))
      .filter((x) => x.node);
  }, [graph, selected]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/40 p-2.5">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-8 w-auto max-w-full text-xs" aria-label="Filter by project">
            <option value="">All projects</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value as MemoryType | "")} className="h-8 w-auto text-xs" aria-label="Filter by memory type">
            <option value="">All types</option>
            {MEMORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEMORY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1.5 px-1 text-xs text-soft">
            <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} className="accent-signal" />
            Concepts (tags)
          </label>
          <label className="flex items-center gap-1.5 px-1 text-xs text-soft">
            <input type="checkbox" checked={showSuggestions} onChange={(e) => setShowSuggestions(e.target.checked)} className="accent-pulse" />
            AI suggestions
          </label>
          <span className="ml-auto px-1 font-mono text-[11px] text-faint">
            {graph.nodes.length} nodes · {graph.edges.length} links
          </span>
        </div>
        <div className="nexus-flow h-[62vh] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-abyss/60">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            minZoom={0.15}
            maxZoom={2.5}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgb(148 163 184 / 0.12)" />
            <Controls showInteractive={false} />
            {nodes.length > 20 ? (
              <MiniMap pannable zoomable nodeColor={(n) => ((n.data as GraphNodeData).kind === "project" ? "#a594f9" : (n.data as GraphNodeData).kind === "memory" ? "#5fd4c8" : "#56627a")} className="!hidden sm:!block" />
            ) : null}
          </ReactFlow>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-dim">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-signal" /> Your connection</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dashed border-pulse" /> AI suggestion (unverified)</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-pulse/40" /> In project</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dotted border-dim" /> Shared tag</span>
        </div>
      </div>

      <aside className="rounded-2xl border border-line bg-panel/50 p-4 lg:self-start">
        {!selected ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Details</p>
            <p className="text-dim">Select a node to see its connections. Drag to pan, scroll or pinch to zoom.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Badge tone={selected.data.kind === "project" ? "pulse" : selected.data.kind === "memory" ? "signal" : "neutral"}>
                {selected.data.kind === "memory" && selected.data.memoryType ? MEMORY_TYPE_LABELS[selected.data.memoryType] : selected.data.kind === "project" ? "Project" : "Concept"}
              </Badge>
              <p className="font-medium break-words">{selected.data.label}</p>
              {selected.data.kind !== "tag" ? (
                <Link
                  href={selected.data.kind === "memory" ? `/memories/${selected.data.refId}` : `/projects/${selected.data.refId}`}
                  className="inline-flex items-center gap-1 text-sm text-signal hover:underline"
                >
                  Open {selected.data.kind} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : (
                <Link href={`/memories?tag=${encodeURIComponent(selected.data.refId)}`} className="inline-flex items-center gap-1 text-sm text-signal hover:underline">
                  Memories with this tag <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-soft uppercase">Linked ({neighbours.length})</p>
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {neighbours.map(({ edge, node }) => (
                  <li key={edge.id} className={cn("rounded-lg p-2 text-sm", edge.data.status === "suggested" ? "border border-dashed border-pulse/30 bg-pulse-deep/15" : "bg-abyss/50")}>
                    <button type="button" className="w-full truncate text-left text-soft hover:text-signal" onClick={() => setSelectedId(node.id)}>
                      {node.data.label}
                    </button>
                    {edge.data.status === "suggested" && edge.data.relationshipId ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[11px] text-pulse">AI suggestion</span>
                        <Button size="sm" variant="ghost" className="ml-auto h-6 px-2" disabled={pending} onClick={() => start(async () => void (await reviewSuggestionAction(edge.data.relationshipId!, "accepted")))}>
                          <Check className="h-3 w-3" aria-hidden /> Accept
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2" disabled={pending} onClick={() => start(async () => void (await reviewSuggestionAction(edge.data.relationshipId!, "rejected")))}>
                          <X className="h-3 w-3" aria-hidden /> Reject
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
