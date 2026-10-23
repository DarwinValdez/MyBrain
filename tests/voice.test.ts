import { beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeExtracted } from "@/lib/ai/extract";
import { formatSegments, nextPartTitle } from "@/lib/voice";
import { createFakeSupabase, firstOp, hasCall, type Query } from "./helpers/fake-supabase";

const { getAuthContext, indexMemory, extractMemoriesFromTranscript, getAiConfig } = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  indexMemory: vi.fn(),
  extractMemoriesFromTranscript: vi.fn(),
  getAiConfig: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext }));
vi.mock("@/lib/indexing", () => ({ indexMemory }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/ai/config", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/config")>()), getAiConfig }));
vi.mock("@/lib/ai/extract", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/extract")>()), extractMemoriesFromTranscript }));

const actions = await import("@/app/actions/voice");

const USER = "11111111-1111-4111-8111-111111111111";
const SESSION = "66666666-6666-4666-8666-666666666666";

function signedIn(handler: (q: Query) => { data?: unknown; error?: unknown } | undefined) {
  const fake = createFakeSupabase({ from: handler });
  getAuthContext.mockResolvedValue({ user: { id: USER, email: null }, supabase: fake.client });
  return fake;
}

beforeEach(() => {
  getAuthContext.mockReset();
  indexMemory.mockReset().mockResolvedValue({ status: "indexed" });
  extractMemoriesFromTranscript.mockReset();
  getAiConfig.mockReset().mockReturnValue({ generation: { apiKey: "k", model: "claude-opus-5-5", effort: "medium" }, embeddings: null });
});

describe("voice helpers", () => {
  it("numbers continuation parts", () => {
    expect(nextPartTitle("Voice session · Oct 23")).toBe("Voice session · Oct 23 (part 2)");
    expect(nextPartTitle("Voice session · Oct 23 (part 2)")).toBe("Voice session · Oct 23 (part 3)");
  });

  it("formats timestamped lines and skips empty speech", () => {
    const text = formatSegments(
      [
        { at: 1, text: "  hola   mundo " },
        { at: 2, text: "   " },
        { at: 3, text: "segunda idea" },
      ],
      (at) => `t${at}`,
    );
    expect(text).toBe("[t1] hola mundo\n[t3] segunda idea");
  });

  it("sanitizes AI proposals", () => {
    const items = sanitizeExtracted([
      { title: "  Decisión   de precio ", content: " Usaremos precio por uso. ", type: "decision", tags: ["Precio", "#Beta", "x", "y", "z"] },
      { title: "", content: "sin título", type: "note", tags: [] },
      ...Array.from({ length: 20 }, (_, i) => ({ title: `t${i}`, content: "c", type: "idea" as const, tags: [] })),
    ]);
    expect(items[0]).toEqual({ title: "Decisión de precio", content: "Usaremos precio por uso.", type: "decision", tags: ["precio", "beta", "x", "y"] });
    expect(items.some((i) => i.content === "sin título")).toBe(false);
    expect(items.length).toBe(15);
  });
});

describe("appendVoiceTranscriptAction", () => {
  it("requires a session", async () => {
    getAuthContext.mockResolvedValue(null);
    expect(await actions.appendVoiceTranscriptAction({ sessionMemoryId: null, title: "t", text: "x" })).toMatchObject({ ok: false });
  });

  it("creates a private #voice memory for a new session and indexes it", async () => {
    const fake = signedIn(() => ({ data: { id: SESSION, title: "Voice session · now", content: "[10:00:00] hola", content_hash: "h" } }));
    const result = await actions.appendVoiceTranscriptAction({ sessionMemoryId: null, title: "Voice session · now", text: "[10:00:00] hola" });
    expect(result).toEqual({ ok: true, data: { memoryId: SESSION, title: "Voice session · now", length: 15 } });
    expect(firstOp(fake.queries[0])?.args[0]).toMatchObject({ owner_id: USER, tags: ["voice"], type: "note", content: "[10:00:00] hola" });
    expect(indexMemory).toHaveBeenCalledOnce();
  });

  it("appends to an existing session owned by the user", async () => {
    const fake = signedIn((q) =>
      firstOp(q)?.method === "select"
        ? { data: { id: SESSION, title: "S", content: "[10:00:00] uno" } }
        : { data: { id: SESSION, title: "S", content: "[10:00:00] uno\n[10:02:00] dos", content_hash: "h2" } },
    );
    const result = await actions.appendVoiceTranscriptAction({ sessionMemoryId: SESSION, title: "S", text: "[10:02:00] dos" });
    expect(result.ok).toBe(true);
    expect(hasCall(fake.queries[0], "eq", "owner_id", USER)).toBe(true);
    const update = firstOp(fake.queries[1])!;
    expect(update.method).toBe("update");
    expect((update.args[0] as { content: string }).content).toBe("[10:00:00] uno\n[10:02:00] dos");
    expect(hasCall(fake.queries[1], "eq", "owner_id", USER)).toBe(true);
  });

  it("rolls over to a new part when the session memory is nearly full", async () => {
    const fake = signedIn((q) =>
      firstOp(q)?.method === "select"
        ? { data: { id: SESSION, title: "S", content: "x".repeat(44_990) } }
        : { data: { id: "77777777-7777-4777-8777-777777777777", title: "S (part 2)", content: "[1] more", content_hash: "h" } },
    );
    const result = await actions.appendVoiceTranscriptAction({ sessionMemoryId: SESSION, title: "S", text: "[1] more text" });
    expect(result).toMatchObject({ ok: true, data: { title: "S (part 2)" } });
    const insert = firstOp(fake.queries[1])!;
    expect(insert.method).toBe("insert");
    expect((insert.args[0] as { title: string }).title).toBe("S (part 2)");
  });

  it("rejects empty or oversized text", async () => {
    signedIn(() => undefined);
    expect((await actions.appendVoiceTranscriptAction({ sessionMemoryId: null, title: "t", text: "  " })).ok).toBe(false);
    expect((await actions.appendVoiceTranscriptAction({ sessionMemoryId: null, title: "t", text: "x".repeat(20_001) })).ok).toBe(false);
  });
});

describe("extractFromVoiceSessionAction", () => {
  it("explains when AI isn't configured", async () => {
    signedIn(() => undefined);
    getAiConfig.mockReturnValue({ generation: null, embeddings: null });
    expect(await actions.extractFromVoiceSessionAction(SESSION)).toMatchObject({ ok: false, message: expect.stringMatching(/AI_PROVIDER_API_KEY/) });
  });

  it("only reads the caller's own session", async () => {
    const fake = signedIn(() => ({ data: null }));
    expect(await actions.extractFromVoiceSessionAction(SESSION)).toEqual({ ok: false, message: "Session not found." });
    expect(hasCall(fake.queries[0], "eq", "owner_id", USER)).toBe(true);
    expect(extractMemoriesFromTranscript).not.toHaveBeenCalled();
  });

  it("returns proposals without saving anything", async () => {
    const fake = signedIn(() => ({ data: { content: "[10:00] decidimos lanzar en diciembre" } }));
    extractMemoriesFromTranscript.mockResolvedValue([{ title: "Lanzamiento", content: "Lanzar en diciembre", type: "decision", tags: [] }]);
    const result = await actions.extractFromVoiceSessionAction(SESSION);
    expect(result).toMatchObject({ ok: true, data: [{ title: "Lanzamiento" }] });
    expect(fake.queries.every((q) => firstOp(q)?.method === "select")).toBe(true);
  });
});

describe("saveExtractedMemoriesAction", () => {
  const item = { title: "Lanzamiento", content: "Lanzar en diciembre", type: "decision" as const, tags: ["plan"] };

  it("saves selected items with owner, #voice tag, and a link back to the session", async () => {
    const fake = signedIn((q) => {
      if (q.table === "memories" && firstOp(q)?.method === "select") return { data: { id: SESSION, title: "Voice session" } };
      if (q.table === "memories") return { data: [{ id: "88888888-8888-4888-8888-888888888888", title: "Lanzamiento", content: "c", content_hash: "h" }] };
      return { data: null };
    });
    const result = await actions.saveExtractedMemoriesAction(SESSION, [item], null);
    expect(result).toEqual({ ok: true, data: { ids: ["88888888-8888-4888-8888-888888888888"] } });
    const insert = fake.queries.find((q) => q.table === "memories" && firstOp(q)?.method === "insert")!;
    expect((firstOp(insert)!.args[0] as object[])[0]).toMatchObject({ owner_id: USER, tags: ["plan", "voice"], type: "decision", project_id: null });
    const link = fake.queries.find((q) => q.table === "memory_relationships")!;
    expect((firstOp(link)!.args[0] as object[])[0]).toMatchObject({ target_memory_id: SESSION, relation_type: "follows", status: "accepted" });
    expect(indexMemory).toHaveBeenCalledOnce();
  });

  it("refuses another user's project", async () => {
    signedIn((q) => (q.table === "projects" ? { data: null } : { data: { id: SESSION, title: "S" } }));
    expect(await actions.saveExtractedMemoriesAction(SESSION, [item], "99999999-9999-4999-8999-999999999999")).toEqual({
      ok: false,
      message: "Project not found.",
    });
  });

  it("validates the selection", async () => {
    signedIn(() => undefined);
    expect((await actions.saveExtractedMemoriesAction(SESSION, [], null)).ok).toBe(false);
    expect((await actions.saveExtractedMemoriesAction(SESSION, [{ ...item, type: "evil" as never }], null)).ok).toBe(false);
  });
});
