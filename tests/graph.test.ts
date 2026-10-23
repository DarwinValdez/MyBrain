import { describe, expect, it } from "vitest";
import type { GraphData } from "@/lib/data/graph";
import { buildGraph, layoutGraph } from "@/lib/graph";

const data: GraphData = {
  memories: [
    { id: "a", title: "A", type: "idea", tags: ["ai", "solo"], projectId: "p", createdAt: "" },
    { id: "b", title: "B", type: "note", tags: ["ai"], projectId: null, createdAt: "" },
    { id: "c", title: "C", type: "note", tags: [], projectId: "p", createdAt: "" },
  ],
  projects: [
    { id: "p", name: "Project", status: "active" },
    { id: "q", name: "Empty", status: "active" },
  ],
  relationships: [
    { id: "r1", source: "a", target: "c", type: "supports", status: "accepted", origin: "user", reason: "" },
    { id: "r2", source: "a", target: "b", type: "related", status: "suggested", origin: "ai", reason: "similar" },
  ],
  truncated: false,
};

const all = { projectId: null, types: null, showTags: true, showSuggestions: true };

describe("buildGraph", () => {
  it("builds memory, project and shared-tag nodes", () => {
    const graph = buildGraph(data, all);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["m:a", "m:b", "m:c", "p:p", "t:ai"]);
    expect(graph.edges.filter((e) => e.data.kind === "project")).toHaveLength(2);
  });

  it("labels AI suggestions and can hide them", () => {
    const suggestion = buildGraph(data, all).edges.find((e) => e.id === "r:r2");
    expect(suggestion?.data).toMatchObject({ status: "suggested", label: "AI suggestion" });
    expect(buildGraph(data, { ...all, showSuggestions: false }).edges.find((e) => e.id === "r:r2")).toBeUndefined();
  });

  it("filters by project and type", () => {
    const byProject = buildGraph(data, { ...all, projectId: "p" });
    expect(byProject.nodes.filter((n) => n.data.kind === "memory").map((n) => n.id)).toEqual(["m:a", "m:c"]);
    const byType = buildGraph(data, { ...all, types: new Set(["note"]) });
    expect(byType.nodes.filter((n) => n.data.kind === "memory").map((n) => n.id)).toEqual(["m:b", "m:c"]);
  });

  it("works with a single memory", () => {
    const graph = buildGraph({ ...data, memories: [data.memories[1]], relationships: [] }, all);
    expect(graph.nodes).toHaveLength(1);
    expect(layoutGraph(graph).get("m:b")).toBeDefined();
  });

  it("lays out deterministically", () => {
    const graph = buildGraph(data, all);
    expect([...layoutGraph(graph).entries()]).toEqual([...layoutGraph(graph).entries()]);
  });
});
