import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";

/** Download everything the signed-in user owns as JSON (embeddings excluded; they can be regenerated). */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { supabase, user } = ctx;

  const [profile, projects, memories, relationships, conversations, messages] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("*").eq("owner_id", user.id).order("created_at"),
    supabase
      .from("memories")
      .select("id, project_id, title, content, type, tags, source_url, source_notes, visibility, index_status, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("created_at"),
    supabase.from("memory_relationships").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("conversations").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("conversation_messages").select("*").eq("owner_id", user.id).order("created_at"),
  ]);

  const failed = [profile, projects, memories, relationships, conversations, messages].find((r) => r.error);
  if (failed?.error) {
    console.error("export failed", failed.error);
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }

  const exportedAt = new Date().toISOString();
  const payload = {
    format: "nexus-export",
    version: 1,
    exportedAt,
    account: { id: user.id, email: user.email, profile: profile.data },
    projects: projects.data,
    memories: memories.data,
    relationships: relationships.data,
    conversations: conversations.data,
    conversationMessages: messages.data,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="nexus-export-${exportedAt.slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
