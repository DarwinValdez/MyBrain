import type { MemoryType, ProjectStatus, RelationType } from "@/lib/database.types";

export const MEMORY_TYPES = [
  "idea",
  "note",
  "fact",
  "decision",
  "research",
  "reflection",
  "meeting",
  "reference",
] as const satisfies readonly MemoryType[];

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  idea: "Idea",
  note: "Note",
  fact: "Fact",
  decision: "Decision",
  research: "Research",
  reflection: "Personal reflection",
  meeting: "Meeting",
  reference: "Reference",
};

export const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const satisfies readonly ProjectStatus[];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

export const RELATION_TYPES = [
  "related",
  "supports",
  "contradicts",
  "follows",
  "inspired_by",
] as const satisfies readonly RelationType[];

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  related: "Related to",
  supports: "Supports",
  contradicts: "Contradicts",
  follows: "Follows from",
  inspired_by: "Inspired by",
};

export const MEMORIES_PAGE_SIZE = 12;

export const LIMITS = {
  title: 200,
  content: 50_000,
  tags: 20,
  tagLength: 40,
  sourceUrl: 2048,
  sourceNotes: 2000,
  projectName: 120,
  projectText: 4000,
  question: 4000,
} as const;
