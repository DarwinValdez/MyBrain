"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { deleteMemoryAction, reindexMemoryAction } from "@/app/actions/memories";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { FormMessage, Spinner } from "@/components/ui/states";

export function DeleteMemoryButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmAction
      action={() => deleteMemoryAction(id)}
      title="Delete this memory?"
      description={
        <>
          “{title}” and its search index and connections will be permanently deleted. This can&apos;t be undone.
        </>
      }
      trigger={
        <>
          <Trash2 className="h-4 w-4" aria-hidden /> Delete
        </>
      }
    />
  );
}

export function ReindexButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string }>();
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(await reindexMemoryAction(id));
          })
        }
      >
        {pending ? <Spinner className="text-current" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
        Retry indexing
      </Button>
      {result ? <FormMessage ok={result.ok} message={result.message} /> : null}
    </div>
  );
}
