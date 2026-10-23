import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth";
import { AiError } from "@/lib/ai/errors";
import { recallErrorResponse, runRecall, RecallNotFoundError } from "@/lib/recall";
import { createFakeSupabase, hasCall, type Query } from "./helpers/fake-supabase";

vi.mock("@/lib/ai/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/embeddings")>();
  return { ...actual, embedTexts: vi.fn(async () => [[0.1]]) };
});

const USER = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const CONVERSATION = "33333333-3333-4333-8333-333333333333";

const chunk = {
  chunk_id: 1,
  memory_id: "mem-1",
  chunk_index: 0,
  content: "We decided on usage-based pricing in March.",
  similarity: 0.82,
  title: "Pricing decision",
  type: "decision",
  tags: ["pricing"],
  project_id: PROJECT,
  memory_created_at: "2026-03-05T00:00:00Z",
  memory_updated_at: "2026-03-05T00:00:00Z",
};

function setup(overrides: { conversation?: unknown; projects?: unknown[]; recentQuestions?: number } = {}) {
  const fake = createFakeSupabase({
    from: (query: Query) => {
      const op = query.calls[0]?.method;
      if (query.table === "projects") return { data: overrides.projects ?? [{ id: PROJECT, name: "Launch" }] };
      if (query.table === "conversations" && op === "select") return { data: overrides.conversation ?? null };
      if (query.table === "conversations" && op === "insert") return { data: { id: CONVERSATION } };
      if (query.table === "conversation_messages" && op === "select") {
        const head = (query.calls[0].args[1] as { head?: boolean } | undefined)?.head;
        return head ? { count: overrides.recentQuestions ?? 0 } : { data: [] };
      }
      if (query.table === "conversation_messages" && op === "insert") {
        const row = query.calls[0].args[0] as Record<string, unknown>;
        return { data: { id: `msg-${row.role}`, created_at: "2026-10-23T00:00:00Z", ...row } };
      }
      return { data: null };
    },
    rpc: (fn) => ({ data: fn === "match_memory_chunks" ? [chunk] : [] }),
  });
  const ctx: AuthContext = { user: { id: USER, email: "a@example.com" }, supabase: fake.client };
  return { fake, ctx };
}

const ai = {
  generation: { apiKey: "k", model: "claude-opus-5-5", effort: "medium" as const },
  embeddings: { provider: "voyage" as const, apiKey: "k", model: "voyage-3.5" },
};

describe("runRecall", () => {
  it("answers from retrieved memories and returns citations linked to them", async () => {
    const { ctx, fake } = setup();
    const generate = vi.fn(async () => ({ text: "You chose usage-based pricing [1]. Inference: revisit it [4].", truncated: false, model: "m" }));

    const result = await runRecall(ctx, { question: "What pricing did I pick?", projectId: PROJECT }, { ai, generate, now: new Date("2026-10-23T12:00:00Z") });

    expect(result.conversationId).toBe(CONVERSATION);
    const [user, assistant] = result.messages;
    expect(user).toMatchObject({ role: "user", content: "What pricing did I pick?" });
    expect(assistant.content).toBe("You chose usage-based pricing [1]. Inference: revisit it .");
    expect(assistant.citations).toEqual([
      expect.objectContaining({ index: 1, memoryId: "mem-1", title: "Pricing decision", excerpt: chunk.content }),
    ]);

    // The prompt contains the retrieved memory and the project scope, and nothing else from the DB.
    const call = generate.mock.calls[0] as unknown as [unknown, { system: string; messages: { content: string }[] }];
    const prompt = call[1].messages.at(-1)!.content;
    expect(prompt).toContain("We decided on usage-based pricing in March.");
    expect(prompt).toContain('only the project "Launch"');
    expect(prompt).toContain("Today's date: 2026-10-23");

    // Retrieval was scoped to the project.
    for (const rpc of fake.rpcs) expect(rpc.args.filter_project_id).toBe(PROJECT);
    // Every table query was filtered by the signed-in owner.
    for (const query of fake.queries) {
      const op = query.calls[0].method;
      if (op === "select" || op === "update") expect(hasCall(query, "eq", "owner_id", USER)).toBe(true);
      if (op === "insert") expect((query.calls[0].args[0] as { owner_id: string }).owner_id).toBe(USER);
    }
  });

  it("rejects a project the user doesn't own before calling the model", async () => {
    const { ctx } = setup({ projects: [] });
    const generate = vi.fn();
    await expect(runRecall(ctx, { question: "q", projectId: PROJECT }, { ai, generate })).rejects.toBeInstanceOf(RecallNotFoundError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects a conversation that isn't found for this user", async () => {
    const { ctx } = setup({ conversation: null });
    await expect(runRecall(ctx, { question: "q", conversationId: CONVERSATION }, { ai, generate: vi.fn() })).rejects.toBeInstanceOf(
      RecallNotFoundError,
    );
  });

  it("keeps the project scope of an existing conversation", async () => {
    const { ctx, fake } = setup({ conversation: { id: CONVERSATION, project_id: PROJECT } });
    const generate = vi.fn(async () => ({ text: "Answer [1]", truncated: false, model: "m" }));
    await runRecall(ctx, { question: "q", conversationId: CONVERSATION, projectId: null }, { ai, generate });
    expect(fake.rpcs[0].args.filter_project_id).toBe(PROJECT);
  });

  it("returns matching sources without an answer when generation isn't configured", async () => {
    const { ctx } = setup();
    const result = await runRecall(ctx, { question: "q" }, { ai: { ...ai, generation: null } });
    expect(result.messages[1].citations).toHaveLength(1);
    expect(result.messages[1].content).toMatch(/no AI model is configured/);
    expect(result.notice).toMatch(/AI_PROVIDER_API_KEY/);
  });

  it("does not persist anything when the provider fails", async () => {
    const { ctx, fake } = setup();
    const generate = vi.fn(async () => {
      throw new AiError("rate_limited", "slow down");
    });
    await expect(runRecall(ctx, { question: "q" }, { ai, generate })).rejects.toMatchObject({ status: 429 });
    expect(fake.queries.some((q) => q.calls[0].method === "insert")).toBe(false);
  });
});

describe("rate limiting", () => {
  it("refuses with 429 once the per-user limit is reached, before any AI call", async () => {
    const { ctx, fake } = setup({ recentQuestions: 10 });
    const generate = vi.fn();
    await expect(runRecall(ctx, { question: "q" }, { ai, generate })).rejects.toMatchObject({ status: 429 });
    expect(generate).not.toHaveBeenCalled();
    expect(fake.rpcs).toHaveLength(0);
    expect(hasCall(fake.queries[0], "eq", "owner_id", USER)).toBe(true);
  });
});

describe("recallErrorResponse", () => {
  it("maps errors to safe HTTP responses", () => {
    expect(recallErrorResponse(new AiError("rate_limited", "x"))).toEqual({ status: 429, message: "x" });
    expect(recallErrorResponse(new RecallNotFoundError("Project not found."))).toEqual({ status: 404, message: "Project not found." });
    expect(recallErrorResponse(new Error("db password is hunter2")).message).not.toMatch(/hunter2/);
  });
});
