import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "signal" | "pulse" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-line-strong bg-raised/60 text-soft",
  signal: "border-signal/25 bg-signal-deep/30 text-signal-strong",
  pulse: "border-pulse/30 bg-pulse-deep/40 text-pulse",
  warn: "border-warn/30 bg-warn/10 text-warn",
  danger: "border-danger/30 bg-danger-deep/40 text-danger",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
