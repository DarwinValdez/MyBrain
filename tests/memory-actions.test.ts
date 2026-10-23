import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryContentHash } from "@/lib/hash";
import { createFakeSupabase, firstOp, hasCall, type Query } from "./helpers/fake-supabase";

const getAuthContext = vi.fn();
const indexMemory = vi.fn();
const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { url });
});

vi.mock("@/lib/auth", () => ({ getAuthContext }));
vi.mock("@/lib/indexing", () => ({ indexMemory }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const actions = await import("@/app/actions/memories");

const USER = "11111111-1111-4111-8111-111111111111";
const MEMORY = "44444444-4444-4444-8444-444444444444";
const OTHER_PROJECT = "55555555-5555-4555-8555-555555555555";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

function signedIn(handler: (q: Query) => { data?: unknown; error?: unknown; count?: number } | undefined) {
  const fake = createFakeSupabase({ from: handler });
  getAuthContext.mockResolvedValue({ user: { id: USER, email: null }, supabase: fake.client });
  return fake;
}

beforeEach(() => {
  getAuthContext.mockReset();
  indexMemory.mockReset().mockResolvedValue({ status: "indexed" });
  redirect.mockClear();
});

describe("memory server actions", () => {
  it("refuse to run without a session", async () => {
    getAuthContext.mockResolvedValue(null);
    expect(await actions.createMemoryAction({ ok: false }, form({ title: "x" }))).toMatchObject({ ok: false });
    expect(await actions.deleteMemoryAction(MEMORY)).toMatchObject({ ok: false });
    expect(await actions.quickCaptureAction({ ok: false }, form({ content: "x" }))).toMatchObject({ ok: false });
    expect(indexMemory).not.toHaveBeenCalled();
  });

  it("create: validates input before touching the database", async () => {
    const fake = signedIn(() => undefined);
    const result = await actions.createMemoryAction({ ok: false }, form({ title: "", sourceUrl: "javascript:alert(1)" }));
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveProperty("title");
    expect(result.errors).toHaveProperty("sourceUrl");
    expect(fake.queries).toHaveLength(0);
  });

  it("create: stores owner, content hash, then indexes and redirects", async () => {
    const fake = signedIn((q) => (q.table === "memories" ? { data: { id: MEMORY, title: "T", content: "C", content_hash: "h" } } : undefined));
    await expect(
      actions.createMemoryAction({ ok: false }, form({ title: "T", content: "C", type: "idea", tags: "a, b" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    const insert = firstOp(fake.queries[0])!;
    expect(insert.method).toBe("insert");
    expect(insert.args[0]).toMatchObject({
      owner_id: USER,
      title: "T",
      content: "C",
      type: "idea",
      tags: ["a", "b"],
      project_id: null,
      content_hash: memoryContentHash("T", "C"),
    });
    expect(indexMemory).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith(`/memories/${MEMORY}`);
  });

  it("create: refuses a project that isn't the caller's", async () => {
    const fake = signedIn((q) => (q.table === "projects" ? { data: null } : undefined));
    const result = await actions.createMemoryAction({ ok: false }, form({ title: "T", projectId: OTHER_PROJECT }));
    expect(result.errors?.projectId).toBe("Project not found.");
    expect(hasCall(fake.queries[0], "eq", "owner_id", USER)).toBe(true);
    expect(fake.queries.some((q) => q.table === "memories")).toBe(false);
  });

  it("update: is scoped to the owner and re-indexes changed text", async () => {
    const fake = signedIn(() => ({ data: { id: MEMORY, title: "T2", content: "C2", content_hash: "h2", index_status: "pending" } }));
    await expect(actions.updateMemoryAction(MEMORY, { ok: false }, form({ title: "T2", content: "C2" }))).rejects.toThrow("NEXT_REDIRECT");
    const query = fake.queries[0];
    expect(firstOp(query)?.method).toBe("update");
    expect(hasCall(query, "eq", "owner_id", USER)).toBe(true);
    expect(hasCall(query, "eq", "id", MEMORY)).toBe(true);
    expect(indexMemory).toHaveBeenCalledOnce();
  });

  it("update: reports not found when the row isn't the caller's", async () => {
    signedIn(() => ({ data: null }));
    expect(await actions.updateMemoryAction(MEMORY, { ok: false }, form({ title: "T" }))).toEqual({ ok: false, message: "Memory not found." });
  });

  it("delete: filters by owner and id; embeddings go via ON DELETE CASCADE", async () => {
    const fake = signedIn(() => ({ count: 1 }));
    await expect(actions.deleteMemoryAction(MEMORY)).rejects.toThrow("NEXT_REDIRECT");
    const query = fake.queries[0];
    expect(query.table).toBe("memories");
    expect(firstOp(query)?.method).toBe("delete");
    expect(hasCall(query, "eq", "owner_id", USER)).toBe(true);
    expect(hasCall(query, "eq", "id", MEMORY)).toBe(true);
  });

  it("delete: rejects malformed ids and reports missing rows", async () => {
    const fake = signedIn(() => ({ count: 0 }));
    expect(await actions.deleteMemoryAction("not-a-uuid")).toMatchObject({ ok: false });
    expect(fake.queries).toHaveLength(0);
    expect(await actions.deleteMemoryAction(MEMORY)).toEqual({ ok: false, message: "Memory not found." });
  });

  it("quick capture: derives a title and reports indexing failures without losing the memory", async () => {
    indexMemory.mockResolvedValue({ status: "failed", error: "provider down" });
    const fake = signedIn(() => ({ data: { id: MEMORY, title: "Buy milk", content: "Buy milk\nand eggs", content_hash: "h" } }));
    const result = await actions.quickCaptureAction({ ok: false }, form({ content: "Buy milk\nand eggs", type: "note" }));
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/indexing failed/i);
    expect(firstOp(fake.queries[0])?.args[0]).toMatchObject({ owner_id: USER, title: "Buy milk" });
  });
});
