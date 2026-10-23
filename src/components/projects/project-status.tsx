import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import type { ProjectStatus } from "@/lib/database.types";

const TONES = { active: "signal", paused: "warn", completed: "pulse", archived: "neutral" } as const;

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={TONES[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}
