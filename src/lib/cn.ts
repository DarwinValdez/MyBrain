import { twMerge } from "tailwind-merge";

/** Join class names, skipping falsy values; later Tailwind classes win conflicts. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
