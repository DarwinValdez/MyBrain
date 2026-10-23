import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthContext = vi.fn();
const runRecall = vi.fn();

vi.mock("@/lib/auth", () => ({ getAuthContext }));
vi.mock("@/lib/recall", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/recall")>();
  return { ...actual, runRecall };
});

const { POST } = await import("@/app/api/recall/route");
const { GET } = await import("@/app/api/export/route");

function post(body: unknown) {
  return new Request("http://localhost/api/recall", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getAuthContext.mockReset();
  runRecall.mockReset();
});

describe("POST /api/recall", () => {
  it("returns 401 without a session and never runs recall", async () => {
    getAuthContext.mockResolvedValue(null);
    const response = await POST(post({ question: "hi" }));
    expect(response.status).toBe(401);
    expect(runRecall).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input", async () => {
    getAuthContext.mockResolvedValue({ user: { id: "u" }, supabase: {} });
    expect((await POST(post({ question: "" }))).status).toBe(400);
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post({ question: "hi", projectId: "../../etc" }))).status).toBe(400);
    expect(runRecall).not.toHaveBeenCalled();
  });

  it("runs recall for the authenticated user", async () => {
    const ctx = { user: { id: "u" }, supabase: {} };
    getAuthContext.mockResolvedValue(ctx);
    runRecall.mockResolvedValue({ conversationId: "c", messages: [], notice: null });
    const response = await POST(post({ question: "What did I decide?" }));
    expect(response.status).toBe(200);
    expect(runRecall).toHaveBeenCalledWith(ctx, { question: "What did I decide?" });
  });

  it("hides internal error details", async () => {
    getAuthContext.mockResolvedValue({ user: { id: "u" }, supabase: {} });
    runRecall.mockRejectedValue(new Error("connection string postgres://secret"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(post({ question: "x" }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(/secret/);
  });
});

describe("GET /api/export", () => {
  it("returns 401 without a session", async () => {
    getAuthContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
});
