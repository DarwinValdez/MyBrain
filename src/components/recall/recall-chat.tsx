"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { deleteConversationAction } from "@/app/actions/account";
import { AnswerText } from "@/components/recall/answer-text";
import { CitationList } from "@/components/recall/citation-list";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { ErrorNotice, Spinner } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/data/conversations";
import { LIMITS } from "@/lib/constants";

type ConversationSummary = { id: string; title: string; projectId: string | null };

type Props = {
  conversations: ConversationSummary[];
  activeConversation: ConversationSummary | null;
  initialMessages: ChatMessage[];
  projects: { id: string; name: string }[];
  initialQuestion?: string;
  initialProjectId?: string;
  aiConfigured: boolean;
};

export function RecallChat({
  conversations,
  activeConversation,
  initialMessages,
  projects,
  initialQuestion,
  initialProjectId,
  aiConfigured,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [conversationId, setConversationId] = useState(activeConversation?.id ?? null);
  const [projectId, setProjectId] = useState(activeConversation?.projectId ?? initialProjectId ?? "");
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);

  const scopeLocked = Boolean(conversationId);
  const projectName = projects.find((p) => p.id === projectId)?.name;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(undefined);
    const optimistic: ChatMessage = { id: `pending-${Date.now()}`, role: "user", content: trimmed, citations: [], createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setQuestion("");

    try {
      const response = await fetch("/api/recall", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed, conversationId, projectId: projectId || null }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login?next=/recall");
          return;
        }
        throw new Error(body?.error ?? "Something went wrong.");
      }
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), ...body.messages]);
      setNotice(body.notice ?? null);
      if (!conversationId) {
        setConversationId(body.conversationId);
        router.replace(`/recall?c=${body.conversationId}`, { scroll: false });
      }
      router.refresh();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setQuestion(trimmed);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  // Questions arriving from the overview search box (?q=) are asked once.
  useEffect(() => {
    if (initialQuestion && !autoAsked.current && !activeConversation) {
      autoAsked.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-3 lg:sticky lg:top-10 lg:self-start">
        <ButtonLink href="/recall" variant="secondary" className="w-full">
          <MessageSquarePlus className="h-4 w-4" aria-hidden /> New conversation
        </ButtonLink>
        {conversations.length ? (
          <nav aria-label="Conversations" className="max-h-48 space-y-0.5 overflow-y-auto lg:max-h-[60vh]">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg pr-1 text-sm",
                  c.id === conversationId ? "bg-signal-deep/30 text-fg" : "text-dim hover:bg-raised/60",
                )}
              >
                <Link href={`/recall?c=${c.id}`} className="min-w-0 flex-1 truncate px-3 py-2" aria-current={c.id === conversationId ? "page" : undefined}>
                  {c.title}
                </Link>
                <button
                  type="button"
                  aria-label={`Delete conversation “${c.title}”`}
                  className="rounded p-1 text-faint opacity-60 hover:text-danger group-hover:opacity-100"
                  onClick={async () => {
                    if (!window.confirm("Delete this conversation? This can't be undone.")) return;
                    await deleteConversationAction(c.id);
                    if (c.id === conversationId) router.push("/recall");
                    else router.refresh();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </nav>
        ) : (
          <p className="px-1 text-xs text-faint">No conversations yet.</p>
        )}
      </aside>

      <section className="flex min-h-[60vh] min-w-0 flex-col rounded-2xl border border-line bg-panel/40">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 text-sm">
          <span className="text-dim">Search in</span>
          <Select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            disabled={scopeLocked || pending}
            className="h-8 w-auto max-w-[60vw] text-xs sm:max-w-xs"
            aria-label="Search scope"
          >
            <option value="">All memories</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                Project: {p.name}
              </option>
            ))}
          </Select>
          {scopeLocked ? <span className="text-xs text-faint">Scope is fixed for this conversation.</span> : null}
        </div>

        <div className="flex-1 space-y-6 px-4 py-5 sm:px-6" aria-live="polite">
          {messages.length === 0 && !pending ? (
            <div className="mx-auto max-w-md space-y-3 py-10 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-signal/20 bg-signal-deep/20 text-signal">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <p className="font-medium">Ask your memories</p>
              <p className="text-sm text-dim">
                Answers are built only from {projectName ? `memories in “${projectName}”` : "your saved memories"} and cite their sources.
                When your notes don&apos;t cover something, NEXUS says so instead of guessing.
              </p>
              {!aiConfigured ? (
                <p className="text-xs text-warn">AI generation isn&apos;t configured on this server; you&apos;ll get matching memories without a written answer.</p>
              ) : null}
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md border border-line-strong bg-raised/80 px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              </div>
            ) : (
              <div key={message.id} className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-signal/80 uppercase">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> NEXUS Recall
                </div>
                <AnswerText text={message.content} citations={message.citations} />
                <CitationList citations={message.citations} />
              </div>
            ),
          )}

          {pending ? (
            <div className="flex items-center gap-2 text-sm text-dim">
              <Spinner /> Searching your memories and composing an answer…
            </div>
          ) : null}
          {notice ? <p className="text-xs text-faint">{notice}</p> : null}
          {error ? <ErrorNotice title="Couldn't answer">{error}</ErrorNotice> : null}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="border-t border-line p-3 sm:p-4">
          <div className="relative">
            <label htmlFor="recall-question" className="sr-only">
              Your question
            </label>
            <Textarea
              id="recall-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask(question);
                }
              }}
              rows={2}
              maxLength={LIMITS.question}
              placeholder="What did I decide about…? What have I learned on…?"
              className="min-h-14 resize-none pr-14"
              disabled={pending}
            />
            <Button type="submit" size="icon" className="absolute right-2 bottom-2" disabled={pending || !question.trim()} aria-label="Ask">
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-faint">
            Relevant excerpts of your memories are sent to the configured AI provider to compose the answer. AI can be wrong — check the sources.
          </p>
        </form>
      </section>
    </div>
  );
}
