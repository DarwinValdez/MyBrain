import { BookOpen, CalendarClock, FileText, FlaskConical, Gavel, Heart, Library, Lightbulb, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MemoryType } from "@/lib/database.types";
import { MEMORY_TYPE_LABELS } from "@/lib/constants";

export const TYPE_ICONS: Record<MemoryType, LucideIcon> = {
  idea: Lightbulb,
  note: FileText,
  fact: BookOpen,
  decision: Gavel,
  research: FlaskConical,
  reflection: Heart,
  meeting: CalendarClock,
  reference: Library,
};

export function TypeBadge({ type }: { type: MemoryType }) {
  const Icon = TYPE_ICONS[type];
  return (
    <Badge tone={type === "decision" || type === "idea" ? "pulse" : "signal"}>
      <Icon className="h-3 w-3" aria-hidden />
      {MEMORY_TYPE_LABELS[type]}
    </Badge>
  );
}
