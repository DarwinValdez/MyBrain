import type { GraphData } from "@/lib/data/graph";
import type { MemoryType } from "@/lib/database.types";

export type NodeKind = "memory" | "project" | "tag";

export type GraphNodeData = {
  kind: NodeKind;
  label: string;
  memoryType?: MemoryType;
  refId: string;
  degree: number;
};

export type GraphEdgeData = {
  kind: "project" | "tag" | "relationship";
  status?: "accepted" | "suggested";
  relationshipId?: string;
  label?: string;
};

export type BuiltGraph = {
  nodes: { id: string; data: GraphNodeData }[];
  edges: { id: string; source: string; target: string; data: GraphEdgeData }[];
};

export type GraphFilters = {
  projectId: string | null;
  types: Set<MemoryType> | null;
  showTags: boolean;
  showSuggestions: boolean;
};

/**
 * Build graph nodes/edges from explicit structure only: project membership,
 * shared tags, and user relationships. AI suggestions are included only when
 * requested, and are marked as such.
 */
export function buildGraph(data: GraphData, filters: GraphFilters): BuiltGraph {
  const memories = data.memories.filter(
    (m) => (!filters.projectId || m.projectId === filters.projectId) && (!filters.types || filters.types.has(m.type)),
  );
  const memoryIds = new Set(memories.map((m) => m.id));
  const nodes: BuiltGraph["nodes"] = [];
  const edges: BuiltGraph["edges"] = [];
  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);

  for (const m of memories) {
    nodes.push({ id: `m:${m.id}`, data: { kind: "memory", label: m.title, memoryType: m.type, refId: m.id, degree: 0 } });
  }

  const projectIds = new Set(memories.map((m) => m.projectId).filter((id): id is string => Boolean(id)));
  if (filters.projectId) projectIds.add(filters.projectId);
  for (const p of data.projects) {
    if (!projectIds.has(p.id)) continue;
    nodes.push({ id: `p:${p.id}`, data: { kind: "project", label: p.name, refId: p.id, degree: 0 } });
  }
  for (const m of memories) {
    if (m.projectId && projectIds.has(m.projectId)) {
      edges.push({ id: `pe:${m.id}`, source: `p:${m.projectId}`, target: `m:${m.id}`, data: { kind: "project" } });
      bump(`p:${m.projectId}`);
      bump(`m:${m.id}`);
    }
  }

  if (filters.showTags) {
    // Only tags shared by 2+ visible memories become concept nodes; singletons add noise.
    const tagMembers = new Map<string, string[]>();
    for (const m of memories) for (const tag of m.tags) tagMembers.set(tag, [...(tagMembers.get(tag) ?? []), m.id]);
    for (const [tag, members] of tagMembers) {
      if (members.length < 2) continue;
      nodes.push({ id: `t:${tag}`, data: { kind: "tag", label: `#${tag}`, refId: tag, degree: 0 } });
      for (const id of members) {
        edges.push({ id: `te:${tag}:${id}`, source: `t:${tag}`, target: `m:${id}`, data: { kind: "tag" } });
        bump(`t:${tag}`);
        bump(`m:${id}`);
      }
    }
  }

  for (const r of data.relationships) {
    if (!memoryIds.has(r.source) || !memoryIds.has(r.target)) continue;
    if (r.status === "suggested" && !filters.showSuggestions) continue;
    edges.push({
      id: `r:${r.id}`,
      source: `m:${r.source}`,
      target: `m:${r.target}`,
      data: {
        kind: "relationship",
        status: r.status,
        relationshipId: r.id,
        label: r.status === "suggested" ? "AI suggestion" : r.type === "related" ? undefined : r.type.replace("_", " "),
      },
    });
    bump(`m:${r.source}`);
    bump(`m:${r.target}`);
  }

  for (const node of nodes) node.data.degree = degree.get(node.id) ?? 0;
  return { nodes, edges };
}

/**
 * Small deterministic force-directed layout (no randomness, so the same data
 * always produces the same picture). Fine for the few hundred nodes we show.
 */
export function layoutGraph(graph: BuiltGraph, iterations = 220): Map<string, { x: number; y: number }> {
  const n = graph.nodes.length;
  const pos = new Map<string, { x: number; y: number }>();
  if (n === 0) return pos;

  const radius = 90 * Math.sqrt(n);
  graph.nodes.forEach((node, i) => {
    // Golden-angle spiral for a stable, well-spread starting point.
    const angle = i * 2.399963229728653;
    const r = radius * Math.sqrt((i + 0.5) / n);
    pos.set(node.id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  });

  const ids = graph.nodes.map((node) => node.id);
  // Nodes are pills ~200px wide, so keep them well apart.
  const ideal = 230;
  let temperature = radius / 4;

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let a = 0; a < n; a++) {
      const pa = pos.get(ids[a])!;
      for (let b = a + 1; b < n; b++) {
        const pb = pos.get(ids[b])!;
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = 0.01 * (a - b);
          dy = 0.01;
          dist = Math.hypot(dx, dy);
        }
        const force = (ideal * ideal) / dist;
        const da = disp.get(ids[a])!;
        const db = disp.get(ids[b])!;
        da.x += (dx / dist) * force;
        da.y += (dy / dist) * force;
        db.x -= (dx / dist) * force;
        db.y -= (dy / dist) * force;
      }
    }
    for (const edge of graph.edges) {
      const ps = pos.get(edge.source);
      const pt = pos.get(edge.target);
      if (!ps || !pt) continue;
      const dx = ps.x - pt.x;
      const dy = ps.y - pt.y;
      const dist = Math.max(Math.hypot(dx, dy), 0.01);
      const force = (dist * dist) / ideal;
      const ds = disp.get(edge.source)!;
      const dt = disp.get(edge.target)!;
      ds.x -= (dx / dist) * force;
      ds.y -= (dy / dist) * force;
      dt.x += (dx / dist) * force;
      dt.y += (dy / dist) * force;
    }
    for (const id of ids) {
      const d = disp.get(id)!;
      const p = pos.get(id)!;
      const len = Math.max(Math.hypot(d.x, d.y), 0.01);
      const step = Math.min(len, temperature);
      // Gentle pull to the centre keeps disconnected nodes on screen.
      p.x += (d.x / len) * step - p.x * 0.01;
      p.y += (d.y / len) * step - p.y * 0.01;
    }
    temperature *= 0.97;
  }
  return pos;
}
