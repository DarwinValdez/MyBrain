import type { Metadata } from "next";
import { Suspense } from "react";
import { Download, KeyRound, ShieldCheck, Sparkles, User } from "lucide-react";
import { DangerForm, ProfileForm, ReindexForm } from "@/components/settings/settings-forms";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { describeAiConfig } from "@/lib/ai/config";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Control" title="Settings" description="Your account, AI configuration, and your data." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const ctx = await requireUser();
  const [{ data: profile }, { count: pending }] = await Promise.all([
    ctx.supabase.from("profiles").select("display_name").eq("id", ctx.user.id).maybeSingle(),
    ctx.supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ctx.user.id)
      .in("index_status", ["pending", "failed"]),
  ]);
  const ai = describeAiConfig();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Account" icon={<User className="h-4 w-4 text-signal" aria-hidden />} />
        <div className="space-y-5 p-5">
          <div className="text-sm">
            <p className="text-xs text-faint">Email</p>
            <p className="text-soft">{ctx.user.email ?? "—"}</p>
          </div>
          <ProfileForm displayName={profile?.display_name ?? ""} />
          <ButtonLink href="/forgot-password" variant="ghost" size="sm" className="-ml-3">
            <KeyRound className="h-3.5 w-3.5" aria-hidden /> Change password by email
          </ButtonLink>
        </div>
      </Card>

      <Card>
        <CardHeader title="AI configuration" icon={<Sparkles className="h-4 w-4 text-signal" aria-hidden />} />
        <div className="space-y-4 p-5 text-sm">
          <p className="text-dim">
            AI providers are configured by whoever deploys NEXUS, through server-side environment variables. Keys are never sent
            to your browser or stored in the database.
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-abyss/50 p-3">
              <dt className="text-xs text-faint">Answer generation</dt>
              <dd className="mt-1 space-y-1">
                {ai.generation.configured ? (
                  <>
                    <Badge tone="signal">Configured</Badge>
                    <p className="text-soft">
                      {ai.generation.provider} · <span className="font-mono text-xs">{ai.generation.model}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <Badge tone="warn">Not configured</Badge>
                    <p className="text-xs text-dim">Set AI_PROVIDER_API_KEY (and optionally AI_MODEL).</p>
                  </>
                )}
              </dd>
            </div>
            <div className="rounded-lg border border-line bg-abyss/50 p-3">
              <dt className="text-xs text-faint">Embeddings (semantic search)</dt>
              <dd className="mt-1 space-y-1">
                {ai.embeddings.configured ? (
                  <>
                    <Badge tone="signal">Configured</Badge>
                    <p className="text-soft">
                      {ai.embeddings.provider} · <span className="font-mono text-xs">{ai.embeddings.model}</span> ·{" "}
                      {ai.embeddings.dimensions}d
                    </p>
                  </>
                ) : (
                  <>
                    <Badge tone="warn">Not configured</Badge>
                    <p className="text-xs text-dim">Set EMBEDDING_PROVIDER and EMBEDDING_API_KEY. Keyword search still works.</p>
                  </>
                )}
              </dd>
            </div>
          </dl>
          <div className="space-y-2">
            <p className="text-soft">
              {pending ? `${pending} memor${pending === 1 ? "y is" : "ies are"} waiting to be indexed or failed indexing.` : "All memories are indexed."}
            </p>
            {pending ? <ReindexForm /> : null}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Privacy & what leaves NEXUS" icon={<ShieldCheck className="h-4 w-4 text-signal" aria-hidden />} />
        <div className="space-y-3 p-5 text-sm text-dim">
          <ul className="list-disc space-y-2 pl-5 marker:text-signal/60">
            <li>
              Every memory is <span className="text-soft">private</span>. Row Level Security in the database restricts every table to
              its owner, and the server checks your session on every request. There is no sharing feature.
            </li>
            <li>
              When a memory is saved or edited, its <span className="text-soft">title and text</span> are sent to the configured
              embedding provider to create search vectors.
            </li>
            <li>
              When you use AI Recall, your <span className="text-soft">question</span>, a few recent turns of the conversation, and
              the <span className="text-soft">excerpts of your most relevant memories</span> (not your whole archive) are sent to the
              AI provider to write the answer.
            </li>
            <li>
              Deleting data in NEXUS removes it from this app&apos;s database. It does <span className="text-soft">not</span> delete
              anything an AI provider may have retained under its own data-retention policy; check your provider&apos;s terms.
            </li>
            <li>
              Data is encrypted in transit and at rest by the hosting providers, but this is <span className="text-soft">not
              end-to-end encryption</span>: the server and database operators can technically read stored content.
            </li>
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your data" icon={<Download className="h-4 w-4 text-signal" aria-hidden />} />
        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <p className="text-sm text-dim">Download all your projects, memories, connections and conversations as JSON.</p>
            <a href="/api/export" className={buttonClasses("secondary", "sm")} download>
              <Download className="h-3.5 w-3.5" aria-hidden /> Export JSON
            </a>
          </div>
          <DangerForm
            kind="conversations"
            label="Delete all conversations"
            description="Removes your AI Recall history. Memories are not affected."
          />
          <DangerForm
            kind="memories"
            label="Delete all memories"
            description="Permanently deletes every memory with its search index and connections. Projects are kept."
          />
          <DangerForm
            kind="account"
            label="Delete account"
            description="Permanently deletes your login and everything you own in NEXUS: profile, projects, memories, embeddings, connections and conversations. Export first if you want a copy. This can't be undone."
          />
        </div>
      </Card>
    </div>
  );
}
