import { z } from "zod";
import { LIMITS, MEMORY_TYPES, PROJECT_STATUSES, RELATION_TYPES } from "@/lib/constants";

const uuid = z.uuid();

/** Empty form values become null; otherwise must be a UUID. */
const optionalUuid = z
  .union([z.literal(""), uuid])
  .nullish()
  .transform((value) => (value ? value : null));

/** Normalise tags: trim, lowercase, collapse spaces to dashes, de-duplicate. */
export function normalizeTags(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input) ? input : (input ?? "").split(",");
  const seen = new Set<string>();
  for (const tag of raw) {
    const clean = tag
      .trim()
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .slice(0, LIMITS.tagLength);
    if (clean) seen.add(clean);
  }
  return [...seen];
}

const tagsField = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => normalizeTags(value))
  .refine((tags) => tags.length <= LIMITS.tags, `At most ${LIMITS.tags} tags.`);

const sourceUrlField = z
  .string()
  .trim()
  .max(LIMITS.sourceUrl)
  .optional()
  .transform((value) => (value ? value : null))
  .refine(
    (value) => {
      if (value === null) return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter a full http(s) URL." },
  );

export const memoryInputSchema = z.object({
  title: z.string().trim().min(1, "Give the memory a title.").max(LIMITS.title),
  content: z.string().max(LIMITS.content, `Content is limited to ${LIMITS.content} characters.`).default(""),
  type: z.enum(MEMORY_TYPES).default("note"),
  tags: tagsField,
  projectId: optionalUuid,
  sourceUrl: sourceUrlField,
  sourceNotes: z.string().trim().max(LIMITS.sourceNotes).optional().default(""),
});
export type MemoryInput = z.output<typeof memoryInputSchema>;

/** Quick capture: just text. A title is derived from the first line if absent. */
export const quickCaptureSchema = z
  .object({
    content: z.string().trim().min(1, "Write something to capture.").max(LIMITS.content),
    title: z.string().trim().max(LIMITS.title).optional(),
    type: z.enum(MEMORY_TYPES).default("note"),
    tags: tagsField,
  })
  .transform((value) => ({
    ...value,
    title: value.title || deriveTitle(value.content),
  }));

export function deriveTitle(content: string): string {
  const firstLine = content.trim().split(/\r?\n/)[0] ?? "";
  const title = firstLine.replace(/\s+/g, " ").trim();
  if (!title) return "Untitled memory";
  return title.length > 80 ? `${title.slice(0, 77).trimEnd()}…` : title;
}

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name.").max(LIMITS.projectName),
  description: z.string().trim().max(LIMITS.projectText).optional().default(""),
  status: z.enum(PROJECT_STATUSES).default("active"),
  goals: z.string().trim().max(LIMITS.projectText).optional().default(""),
  nextSteps: z.string().trim().max(LIMITS.projectText).optional().default(""),
});
export type ProjectInput = z.output<typeof projectInputSchema>;

export const SORT_FIELDS = ["created", "updated"] as const;

/** Query-string filters for the memory list. Invalid values fall back to defaults. */
export const memoryFiltersSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  type: z.enum(MEMORY_TYPES).optional().catch(undefined),
  tag: z
    .string()
    .optional()
    .transform((value): string | undefined => normalizeTags(value)[0])
    .catch(undefined),
  project: z.union([uuid, z.literal("none")]).optional().catch(undefined),
  sort: z.enum(SORT_FIELDS).default("created").catch("created"),
  order: z.enum(["asc", "desc"]).default("desc").catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type MemoryFilters = z.output<typeof memoryFiltersSchema>;

export const recallRequestSchema = z.object({
  question: z.string().trim().min(1, "Ask a question.").max(LIMITS.question),
  conversationId: uuid.optional().nullable(),
  projectId: uuid.optional().nullable(),
});
export type RecallRequest = z.output<typeof recallRequestSchema>;

export const relationshipInputSchema = z
  .object({
    sourceMemoryId: uuid,
    targetMemoryId: uuid,
    relationType: z.enum(RELATION_TYPES).default("related"),
  })
  .refine((value) => value.sourceMemoryId !== value.targetMemoryId, {
    message: "A memory can't be linked to itself.",
    path: ["targetMemoryId"],
  });

export const idSchema = uuid;

/** Read a FormData into a plain object for schema parsing. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) result[key] = value;
  }
  return result;
}

/** Flatten zod issues into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
