import { useId } from "react";
import { cn } from "@/lib/cn";

/** NEXUS mark: a small constellation of linked nodes. */
export function LogoMark({ className }: { className?: string }) {
  // Unique per instance: a gradient defined inside a hidden (display:none) copy
  // of the logo would otherwise leave every other copy without strokes.
  const gradientId = `nexus-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden fill="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8ae6dc" />
          <stop offset="1" stopColor="#a594f9" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" stroke={`url(#${gradientId})`} strokeOpacity="0.35" />
      <path
        d="M9 11.5 16 7l7 4.5M9 11.5v9L16 25l7-4.5v-9M9 11.5 16 16l7-4.5M16 16v9"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="2.2" fill="#8ae6dc" />
      <circle cx="9" cy="11.5" r="1.4" fill="#5fd4c8" />
      <circle cx="23" cy="11.5" r="1.4" fill="#a594f9" />
      <circle cx="16" cy="25" r="1.4" fill="#5fd4c8" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-mono text-sm font-semibold tracking-[0.32em] text-fg">NEXUS</span>
    </span>
  );
}
