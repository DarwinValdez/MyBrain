"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Accessible modal built on the native <dialog> element. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line-strong bg-deep p-0 text-fg shadow-2xl shadow-black/60 open:animate-fade-in"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="space-y-1">
          <h2 id="dialog-title" className="text-base font-semibold">
            {title}
          </h2>
          {description ? <div className="text-sm text-dim">{description}</div> : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-5 py-4">{open ? children : null}</div>
    </dialog>
  );
}
