"use client";

import { useTransition } from "react";
import { Trash2, Unlink } from "lucide-react";
import { setMemoryProjectAction } from "@/app/actions/memories";
import { deleteProjectAction } from "@/app/actions/projects";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Spinner } from "@/components/ui/states";

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      action={() => deleteProjectAction(id)}
      title="Delete this project?"
      description={<>“{name}” will be deleted. Its memories are kept and simply lose the project association.</>}
      trigger={
        <>
          <Trash2 className="h-4 w-4" aria-hidden /> Delete
        </>
      }
    />
  );
}

export function RemoveFromProjectButton({ memoryId, title }: { memoryId: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setMemoryProjectAction(memoryId, null)))}
      className="relative z-10 rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-soft"
      aria-label={`Remove “${title}” from this project`}
      title="Remove from project"
    >
      {pending ? <Spinner /> : <Unlink className="h-3.5 w-3.5" />}
    </button>
  );
}
