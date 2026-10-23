"use client";

import { useActionState } from "react";
import { createMemoryAction, updateMemoryAction } from "@/app/actions/memories";
import { initialActionState, type ActionState } from "@/app/actions/types";
import { ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { LIMITS, MEMORY_TYPES, MEMORY_TYPE_LABELS } from "@/lib/constants";
import type { Memory, Project } from "@/lib/database.types";

type Props = {
  projects: Pick<Project, "id" | "name">[];
  memory?: Memory;
  defaultProjectId?: string;
};

export function MemoryForm({ projects, memory, defaultProjectId }: Props) {
  const action = memory
    ? (updateMemoryAction.bind(null, memory.id) as (s: ActionState, f: FormData) => Promise<ActionState>)
    : createMemoryAction;
  const [state, formAction] = useActionState(action, initialActionState);
  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field label="Title" htmlFor="title" error={err.title}>
        <Input
          id="title"
          name="title"
          required
          maxLength={LIMITS.title}
          defaultValue={v?.title ?? memory?.title}
          placeholder="What is this memory about?"
          aria-invalid={Boolean(err.title)}
          autoFocus={!memory}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Type" htmlFor="type" error={err.type}>
          <Select id="type" name="type" defaultValue={v?.type ?? memory?.type ?? "note"}>
            {MEMORY_TYPES.map((type) => (
              <option key={type} value={type}>
                {MEMORY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor="projectId" error={err.projectId}>
          <Select id="projectId" name="projectId" defaultValue={v?.projectId ?? memory?.project_id ?? defaultProjectId ?? ""}>
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Content" htmlFor="content" error={err.content} hint="Plain text. Long notes are split into chunks for semantic search.">
        <Textarea
          id="content"
          name="content"
          rows={12}
          maxLength={LIMITS.content}
          defaultValue={v?.content ?? memory?.content}
          placeholder="Write freely. Markdown-style lists and line breaks are kept as text."
          aria-invalid={Boolean(err.content)}
        />
      </Field>

      <Field label="Tags" htmlFor="tags" error={err.tags} hint={`Comma separated, up to ${LIMITS.tags}.`}>
        <Input id="tags" name="tags" defaultValue={v?.tags ?? memory?.tags.join(", ")} placeholder="strategy, onboarding" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Source URL" htmlFor="sourceUrl" error={err.sourceUrl} hint="Optional.">
          <Input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            inputMode="url"
            defaultValue={v?.sourceUrl ?? memory?.source_url ?? ""}
            placeholder="https://"
            aria-invalid={Boolean(err.sourceUrl)}
          />
        </Field>
        <Field label="Where it came from" htmlFor="sourceNotes" error={err.sourceNotes} hint="Optional — a book, a conversation, a meeting…">
          <Input id="sourceNotes" name="sourceNotes" maxLength={LIMITS.sourceNotes} defaultValue={v?.sourceNotes ?? memory?.source_notes} />
        </Field>
      </div>

      <p className="text-xs text-faint">Private — visible only to you.</p>
      <FormMessage ok={state.ok} message={state.message} />
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={memory ? `/memories/${memory.id}` : "/memories"} variant="secondary">
          Cancel
        </ButtonLink>
        <SubmitButton pendingLabel="Saving…">{memory ? "Save changes" : "Save memory"}</SubmitButton>
      </div>
    </form>
  );
}
