import "server-only";
import type { AuthContext } from "@/lib/auth";
import { getAiConfig, type AiConfig } from "@/lib/ai/config";
import { extractCitations, type Citation } from "@/lib/ai/citations";
import { AiError } from "@/lib/ai/errors";
import { generateAnswer } from "@/lib/ai/generate";
import { buildMessages, SYSTEM_PROMPT, type HistoryTurn } from "@/lib/ai/prompt";
import { retrieveContext } from "@/lib/ai/retrieval";
import { toChatMessage, type ChatMessage } from "@/lib/data/conversations";
import type { Json } from "@/lib/database.types";
import type { RecallRequest } from "@/lib/validation";

export class RecallNotFoundError extends Error {}

/** Per-user limit, counted from stored questions so it works across serverless instances. */
export const RECALL_RATE_LIMIT = { questions: 10, windowSeconds: 60 };

export type RecallResponse = {
  conversationId: string;
  messages: ChatMessage[];
  notice: string | null;
};

/**
 * AI Recall: retrieve the signed-in user's relevant memories, ask the model,
 * map its [n] markers to citations, and persist the exchange.
 *
 * Authorization is enforced by the caller passing an AuthContext (verified
 * session), by explicit owner filters here, and by RLS in the database.
 */
export async function runRecall(
  ctx: AuthContext,
  input: RecallRequest,
  deps: { ai?: AiConfig; generate?: typeof generateAnswer; now?: Date } = {},
): Promise<RecallResponse> {
  const { supabase, user } = ctx;
  const ai = deps.ai ?? getAiConfig();
  const generate = deps.generate ?? generateAnswer;
  const now = deps.now ?? new Date();

  const since = new Date(now.getTime() - RECALL_RATE_LIMIT.windowSeconds * 1000).toISOString();
  const { count: recent, error: rateError } = await supabase
    .from("conversation_messages")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("role", "user")
    .gte("created_at", since);
  if (rateError) throw rateError;
  if ((recent ?? 0) >= RECALL_RATE_LIMIT.questions) {
    throw new AiError("rate_limited", "You're asking questions faster than NEXUS allows. Wait a minute and try again.");
  }

  // Resolve the conversation and scope. A conversation keeps the project scope it started with.
  let conversationId = input.conversationId ?? null;
  let projectId = input.projectId ?? null;
  let history: HistoryTurn[] = [];

  if (conversationId) {
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("id, project_id")
      .eq("owner_id", user.id)
      .eq("id", conversationId)
      .maybeSingle();
    if (error) throw error;
    if (!conversation) throw new RecallNotFoundError("Conversation not found.");
    projectId = conversation.project_id;

    const { data: rows, error: historyError } = await supabase
      .from("conversation_messages")
      .select("role, content")
      .eq("owner_id", user.id)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(6);
    if (historyError) throw historyError;
    history = (rows ?? []).reverse();
  }

  const projectNames = new Map<string, string>();
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("owner_id", user.id)
    .limit(500);
  if (projectsError) throw projectsError;
  for (const p of projects ?? []) projectNames.set(p.id, p.name);
  if (projectId && !projectNames.has(projectId)) throw new RecallNotFoundError("Project not found.");

  const retrieval = await retrieveContext(supabase, { question: input.question, projectId, embeddings: ai.embeddings });

  let answer: string;
  let citations: Citation[];
  let notice = retrieval.notice;

  if (ai.generation) {
    const messages = buildMessages({
      question: input.question,
      items: retrieval.items,
      history,
      projectNames,
      scopeLabel: projectId ? `only the project "${projectNames.get(projectId)}"` : "all memories",
      today: now.toISOString().slice(0, 10),
    });
    const generated = await generate(ai.generation, { system: SYSTEM_PROMPT, messages });
    ({ text: answer, citations } = extractCitations(generated.text, retrieval.items));
    if (generated.truncated) answer += "\n\n(Answer was cut off because it reached the length limit.)";
  } else {
    // Without a generation model, still return the retrieved memories as sources.
    notice = [notice, "AI answer generation is not configured (set AI_PROVIDER_API_KEY)."].filter(Boolean).join(" ");
    const markers = retrieval.items.map((item) => `[${item.index}]`).join(" ");
    const fallback = retrieval.items.length
      ? `I can't generate an answer because no AI model is configured, but these saved memories look relevant: ${markers}`
      : "I can't generate an answer because no AI model is configured, and no saved memories matched this question.";
    ({ text: answer, citations } = extractCitations(fallback, retrieval.items));
  }

  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ owner_id: user.id, project_id: projectId, title: conversationTitle(input.question) })
      .select("id")
      .single();
    if (error) throw error;
    conversationId = created.id;
  }

  // Two inserts (two transactions) so the messages get distinct timestamps and stable order.
  const savedUser = await supabase
    .from("conversation_messages")
    .insert({ conversation_id: conversationId, owner_id: user.id, role: "user", content: input.question, citations: [] })
    .select("*")
    .single();
  if (savedUser.error) throw savedUser.error;
  const savedAssistant = await supabase
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      owner_id: user.id,
      role: "assistant",
      content: answer,
      citations: citations as unknown as Json,
    })
    .select("*")
    .single();
  if (savedAssistant.error) throw savedAssistant.error;

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("owner_id", user.id)
    .eq("id", conversationId);

  return { conversationId, messages: [toChatMessage(savedUser.data), toChatMessage(savedAssistant.data)], notice };
}

export function conversationTitle(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean || "New conversation";
}

export function recallErrorResponse(error: unknown): { status: number; message: string } {
  if (error instanceof AiError) return { status: error.status, message: error.message };
  if (error instanceof RecallNotFoundError) return { status: 404, message: error.message };
  return { status: 500, message: "Something went wrong while answering. Please try again." };
}
