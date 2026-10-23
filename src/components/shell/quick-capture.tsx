"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Zap } from "lucide-react";
import { quickCaptureAction } from "@/app/actions/memories";
import { initialActionState } from "@/app/actions/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { MEMORY_TYPES, MEMORY_TYPE_LABELS } from "@/lib/constants";

/** Save a thought in seconds. Opens with the button or the "c" key (when not typing). */
export function QuickCapture({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      // Several instances exist (desktop sidebar, mobile header); only the visible one responds.
      const visible = triggerRef.current?.offsetParent !== null;
      if (visible && !typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key === "c") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <span ref={triggerRef} className="block">
      {compact ? (
        <Button size="sm" onClick={() => setOpen(true)} aria-label="Quick capture">
          <Plus className="h-4 w-4" aria-hidden />
          Capture
        </Button>
      ) : (
        <Button className="w-full justify-start" onClick={() => setOpen(true)}>
          <Zap className="h-4 w-4" aria-hidden />
          Quick capture
          <kbd className="ml-auto rounded border border-void/30 px-1.5 font-mono text-[10px] opacity-70">C</kbd>
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setFormKey((k) => k + 1);
        }}
        title="Quick capture"
        description="Write it down now; organise later. Saved privately to your memories."
      >
        <QuickCaptureForm key={formKey} />
      </Dialog>
    </span>
  );
}

function QuickCaptureForm() {
  const [state, formAction] = useActionState(quickCaptureAction, initialActionState);
  const saved = state.ok && state.data?.id;

  if (saved) {
    return (
      <div className="space-y-4">
        <FormMessage ok message={state.message} />
        <p className="text-sm text-soft">
          Saved as <span className="font-medium text-fg">{String(state.data?.title)}</span>.
        </p>
        <Link href={`/memories/${state.data?.id}`} className="text-sm text-signal hover:underline">
          Open memory →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Thought" htmlFor="qc-content" error={state.errors?.content}>
        <Textarea
          id="qc-content"
          name="content"
          autoFocus
          required
          rows={5}
          placeholder="An idea, a decision, something you learned…"
          defaultValue={state.values?.content}
          aria-invalid={Boolean(state.errors?.content)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="qc-type">
          <Select id="qc-type" name="type" defaultValue={state.values?.type ?? "note"}>
            {MEMORY_TYPES.map((type) => (
              <option key={type} value={type}>
                {MEMORY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tags" htmlFor="qc-tags" hint="Comma separated" error={state.errors?.tags}>
          <Input id="qc-tags" name="tags" placeholder="research, ai" defaultValue={state.values?.tags} />
        </Field>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save memory</SubmitButton>
      </div>
    </form>
  );
}
