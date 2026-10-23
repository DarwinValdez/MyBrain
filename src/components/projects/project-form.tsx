"use client";

import { useActionState } from "react";
import { createProjectAction, updateProjectAction } from "@/app/actions/projects";
import { initialActionState, type ActionState } from "@/app/actions/types";
import { ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { LIMITS, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/constants";
import type { Project } from "@/lib/database.types";

export function ProjectForm({ project }: { project?: Project }) {
  const action = project
    ? (updateProjectAction.bind(null, project.id) as (s: ActionState, f: FormData) => Promise<ActionState>)
    : createProjectAction;
  const [state, formAction] = useActionState(action, initialActionState);
  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <Field label="Name" htmlFor="name" error={err.name}>
          <Input
            id="name"
            name="name"
            required
            maxLength={LIMITS.projectName}
            defaultValue={v?.name ?? project?.name}
            aria-invalid={Boolean(err.name)}
            autoFocus={!project}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={v?.status ?? project?.status ?? "active"}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" htmlFor="description" error={err.description}>
        <Textarea id="description" name="description" rows={4} maxLength={LIMITS.projectText} defaultValue={v?.description ?? project?.description} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Goals" htmlFor="goals" error={err.goals} hint="Optional">
          <Textarea id="goals" name="goals" rows={4} maxLength={LIMITS.projectText} defaultValue={v?.goals ?? project?.goals} />
        </Field>
        <Field label="Next steps" htmlFor="nextSteps" error={err.nextSteps} hint="Optional">
          <Textarea id="nextSteps" name="nextSteps" rows={4} maxLength={LIMITS.projectText} defaultValue={v?.nextSteps ?? project?.next_steps} />
        </Field>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
      <div className="flex justify-end gap-2">
        <ButtonLink href={project ? `/projects/${project.id}` : "/projects"} variant="secondary">
          Cancel
        </ButtonLink>
        <SubmitButton pendingLabel="Saving…">{project ? "Save changes" : "Create project"}</SubmitButton>
      </div>
    </form>
  );
}
