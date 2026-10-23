"use client";

import { useActionState, useTransition, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  deleteAccountAction,
  deleteAllConversationsAction,
  deleteAllMemoriesAction,
  reindexOutstandingAction,
  updateProfileAction,
} from "@/app/actions/account";
import { initialActionState, type ActionState } from "@/app/actions/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, Spinner } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Display name" htmlFor="displayName" error={state.errors?.displayName} className="flex-1">
        <Input id="displayName" name="displayName" maxLength={80} defaultValue={displayName} />
      </Field>
      <SubmitButton variant="secondary" pendingLabel="Saving…">
        Save
      </SubmitButton>
      <FormMessage ok={state.ok} message={state.message} />
    </form>
  );
}

export function ReindexForm() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>();
  return (
    <div className="space-y-2">
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => setResult(await reindexOutstandingAction()))}>
        {pending ? <Spinner className="text-current" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
        Index pending &amp; failed memories
      </Button>
      {result ? <FormMessage ok={result.ok} message={result.message} /> : null}
    </div>
  );
}

/** Destructive bulk action that requires typing DELETE. */
export function DangerForm({
  kind,
  label,
  description,
}: {
  kind: "conversations" | "memories" | "account";
  label: string;
  description: string;
}) {
  const fn = kind === "conversations" ? deleteAllConversationsAction : kind === "memories" ? deleteAllMemoriesAction : deleteAccountAction;
  const [state, action] = useActionState(fn, initialActionState);
  const id = `confirm-${kind}`;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-danger/20 bg-danger-deep/10 p-4">
      <div>
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="mt-0.5 text-sm text-dim">{description}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Type DELETE to confirm" htmlFor={id} error={state.errors?.confirm} className="flex-1">
          <Input id={id} name="confirm" autoComplete="off" placeholder="DELETE" />
        </Field>
        <SubmitButton variant="danger" pendingLabel="Deleting…">
          {label}
        </SubmitButton>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
    </form>
  );
}
