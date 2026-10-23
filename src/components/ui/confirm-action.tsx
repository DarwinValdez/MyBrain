"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, Spinner } from "@/components/ui/states";
import type { ActionState } from "@/app/actions/types";

/** A button that asks for confirmation before running a destructive server action. */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel = "Delete",
  trigger,
  triggerVariant = "danger",
  triggerSize = "md",
}: {
  action: () => Promise<ActionState | void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  trigger: ReactNode;
  triggerVariant?: "danger" | "secondary" | "ghost";
  triggerSize?: "sm" | "md" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <div className="space-y-4">
          <FormMessage ok={false} message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(undefined);
                  const result = await action();
                  if (result && !result.ok) setError(result.message ?? "Action failed.");
                  else setOpen(false);
                })
              }
            >
              {pending ? <Spinner className="text-current" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
