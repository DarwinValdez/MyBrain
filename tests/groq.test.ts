import { describe, expect, it, vi } from "vitest";
import { detectGenerationProvider, getAiConfig, type GenerationConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/errors";
import { extractMemoriesFromTranscript } from "@/lib/ai/extract";
import { buildGroqRequest, groqChat, stripThinking } from "@/lib/ai/groq";

const groq: GenerationConfig = { provider: "groq", apiKey: "gsk_test", model: "openai/gpt-oss-120b", effort: "medium", baseUrl: "https://api.groq.com/openai/v1" };

function reply(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("provider detection", () => {
  it("recognises Groq keys and defaults to a free-tier model", () => {
    expect(detectGenerationProvider("gsk_abc")).toBe("groq");
    expect(detectGenerationProvider("sk-ant-abc")).toBe("anthropic");
    expect(detectGenerationProvider("gsk_abc", "anthropic")).toBe("anthropic");
    const config = getAiConfig({ AI_PROVIDER_API_KEY: "gsk_abc" } as unknown as NodeJS.ProcessEnv);
    expect(config.generation).toEqual({
      provider: "groq",
      apiKey: "gsk_abc",
      model: "openai/gpt-oss-120b",
      effort: "medium",
      baseUrl: "https://api.groq.com/openai/v1",
    });
  });
});

describe("groqChat", () => {
  it("sends an OpenAI-compatible request with the system prompt first and the key only in the header", async () => {
    const fetchMock = reply({ model: "openai/gpt-oss-120b", choices: [{ finish_reason: "stop", message: { content: "Respuesta [1]" } }] });
    const result = await groqChat(groq, { system: "SYS", messages: [{ role: "user", content: "hola" }] }, fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ text: "Respuesta [1]", truncated: false, model: "openai/gpt-oss-120b" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer gsk_test");
    const body = JSON.parse(String(init.body));
    expect(body.messages).toEqual([{ role: "system", content: "SYS" }, { role: "user", content: "hola" }]);
    expect(body.reasoning_effort).toBe("medium");
    expect(String(init.body)).not.toContain("gsk_test");
  });

  it("only sends reasoning_effort to models that support it", () => {
    expect(buildGroqRequest({ ...groq, model: "qwen/qwen3-32b" }, { system: "s", messages: [] }).body).not.toHaveProperty("reasoning_effort");
    expect(buildGroqRequest({ ...groq, effort: "max" }, { system: "s", messages: [] }).body).toMatchObject({ reasoning_effort: "high" });
  });

  it("maps free-tier limits and bad keys to clear errors", async () => {
    await expect(groqChat(groq, { system: "s", messages: [] }, reply({}, 429) as unknown as typeof fetch)).rejects.toMatchObject({ kind: "rate_limited", status: 429 });
    await expect(groqChat(groq, { system: "s", messages: [] }, reply({}, 401) as unknown as typeof fetch)).rejects.toMatchObject({ kind: "auth" });
    await expect(groqChat(groq, { system: "s", messages: [] }, reply({ choices: [] }) as unknown as typeof fetch)).rejects.toBeInstanceOf(AiError);
  });

  it("removes <think> blocks and flags truncation", async () => {
    expect(stripThinking("<think>razonando…</think>\nHola")).toBe("Hola");
    const result = await groqChat(groq, { system: "s", messages: [] }, reply({ choices: [{ finish_reason: "length", message: { content: "parcial" } }] }) as unknown as typeof fetch);
    expect(result.truncated).toBe(true);
  });
});

describe("extraction with Groq", () => {
  it("uses JSON mode and repairs loose output", async () => {
    const chat = vi.fn(async () => ({
      text: JSON.stringify({
        memories: [
          { title: "Lanzar en diciembre", content: "Decidimos lanzar en diciembre.", type: "decision", tags: ["Beta"] },
          { title: "Llamar a Ana", content: "Tarea: llamar a Ana.", type: "task", tags: "no-array" },
          { title: "", content: "" },
        ],
      }),
      truncated: false,
      model: "m",
    }));
    const items = await extractMemoriesFromTranscript(groq, "texto", undefined, chat);
    expect(items).toEqual([
      { title: "Lanzar en diciembre", content: "Decidimos lanzar en diciembre.", type: "decision", tags: ["beta"] },
      { title: "Llamar a Ana", content: "Tarea: llamar a Ana.", type: "note", tags: [] },
    ]);
    const call = chat.mock.calls[0] as unknown as [GenerationConfig, { system: string; json: boolean }];
    expect(call[1].json).toBe(true);
    expect(call[1].system).toMatch(/JSON/);
  });

  it("reports invalid JSON as a bad response", async () => {
    const chat = vi.fn(async () => ({ text: "not json", truncated: false, model: "m" }));
    await expect(extractMemoriesFromTranscript(groq, "x", undefined, chat)).rejects.toMatchObject({ kind: "bad_response" });
  });
});
