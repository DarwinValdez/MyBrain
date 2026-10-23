import "server-only";
import type { AuthContext } from "@/lib/auth";
import type { Citation } from "@/lib/ai/citations";
import type { Conversation, ConversationMessage } from "@/lib/database.types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
};

export async function listConversations({ supabase, user }: AuthContext): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getConversation({ supabase, user }: AuthContext, id: string): Promise<Conversation | null> {
  const { data, error } = await supabase.from("conversations").select("*").eq("owner_id", user.id).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMessages({ supabase, user }: AuthContext, conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("*")
    .eq("owner_id", user.id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map(toChatMessage);
}

export function toChatMessage(row: ConversationMessage): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citations: Array.isArray(row.citations) ? (row.citations as unknown as Citation[]) : [],
    createdAt: row.created_at,
  };
}
