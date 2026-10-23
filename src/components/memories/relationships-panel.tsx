"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Check, Link2, Sparkles, Trash2, X } from "lucide-react";
import {
  createRelationshipAction,
  deleteRelationshipAction,
  reviewSuggestionAction,
  suggestConnectionsAction,
} from "@/app/actions/relationships";
import { initialActionState } from "@/app/actions/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { FormMessage, Spinner } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { RELATION_TYPES, RELATION_TYPE_LABELS } from "@/lib/constants";
import type { RelatedMemory } from "@/lib/data/memories";

export function RelationshipsPanel({
  memoryId,
  related,
  options,
  canSuggest,
}: {
  memoryId: string;
  related: RelatedMemory[];
  options: { id: string; title: string }[];
  canSuggest: boolean;
}) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message?: string }>();
  const [linkState, linkAction] = useActionState(createRelationshipAction, initialActionState);

  const accepted = related.filter((r) => r.relationship.status === "accepted");
  const suggested = related.filter((r) => r.relationship.status === "suggested");
  const linkedIds = new Set(related.map((r) => r.other.id));

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const result = await fn();
      setNotice(result.message || !result.ok ? result : undefined);
    });

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-xs font-medium tracking-wide text-soft uppercase">Connections</h3>
        {accepted.length === 0 ? (
          <p className="text-sm text-dim">No confirmed connections yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {accepted.map(({ relationship, other }) => (
              <li key={relationship.id} className="flex items-center gap-2 text-sm">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-signal" aria-hidden />
                <span className="shrink-0 text-xs text-dim">{RELATION_TYPE_LABELS[relationship.relation_type]}</span>
                <Link href={`/memories/${other.id}`} className="min-w-0 truncate text-soft hover:text-signal">
                  {other.title}
                </Link>
                <button
                  type="button"
                  className="ml-auto rounded p-1 text-faint hover:text-danger"
                  aria-label={`Remove connection to ${other.title}`}
                  disabled={pending}
                  onClick={() => run(() => deleteRelationshipAction(relationship.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium tracking-wide text-soft uppercase">AI suggestions</h3>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || !canSuggest}
            title={canSuggest ? undefined : "Available once this memory is indexed"}
            onClick={() => run(() => suggestConnectionsAction(memoryId))}
          >
            {pending ? <Spinner className="text-current" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            Suggest
          </Button>
        </div>
        <p className="text-xs text-faint">
          Suggestions come from semantic similarity. They are not facts and don&apos;t appear as connections until you accept them.
        </p>
        {suggested.length ? (
          <ul className="space-y-1.5">
            {suggested.map(({ relationship, other }) => (
              <li key={relationship.id} className="rounded-lg border border-dashed border-pulse/30 bg-pulse-deep/15 p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge tone="pulse">Suggested</Badge>
                  <Link href={`/memories/${other.id}`} className="min-w-0 truncate text-soft hover:text-signal">
                    {other.title}
                  </Link>
                </div>
                {relationship.reason ? <p className="mt-1 text-xs text-dim">{relationship.reason}</p> : null}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => reviewSuggestionAction(relationship.id, "accepted"))}>
                    <Check className="h-3.5 w-3.5" aria-hidden /> Accept
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => reviewSuggestionAction(relationship.id, "rejected"))}>
                    <X className="h-3.5 w-3.5" aria-hidden /> Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {notice ? <FormMessage ok={notice.ok} message={notice.message} /> : null}

      <section className="space-y-2">
        <h3 className="text-xs font-medium tracking-wide text-soft uppercase">Link a memory</h3>
        {options.length ? (
          <form action={linkAction} className="space-y-2">
            <input type="hidden" name="sourceMemoryId" value={memoryId} />
            <Select name="relationType" defaultValue="related" aria-label="Relationship type">
              {RELATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {RELATION_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Select name="targetMemoryId" required defaultValue="" aria-label="Memory to link">
              <option value="" disabled>
                Choose a memory…
              </option>
              {options
                .filter((o) => !linkedIds.has(o.id))
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
            </Select>
            <FormMessage ok={linkState.ok} message={linkState.message ?? linkState.errors?.targetMemoryId} />
            <SubmitButton size="sm" variant="secondary" pendingLabel="Linking…">
              <Link2 className="h-3.5 w-3.5" aria-hidden /> Add connection
            </SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-dim">Save another memory to link it here.</p>
        )}
      </section>
    </div>
  );
}
