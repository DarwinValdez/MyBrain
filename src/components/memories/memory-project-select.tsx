"use client";

import { useState, useTransition } from "react";
import { setMemoryProjectAction } from "@/app/actions/memories";
import { Select } from "@/components/ui/field";
import { FormMessage, Spinner } from "@/components/ui/states";

/** Associate a memory with a project, or remove the association. */
export function MemoryProjectSelect({
  memoryId,
  projectId,
  projects,
}: {
  memoryId: string;
  projectId: string | null;
  projects: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          aria-label="Project"
          defaultValue={projectId ?? ""}
          disabled={pending}
          onChange={(event) => {
            const value = event.target.value || null;
            start(async () => {
              const result = await setMemoryProjectAction(memoryId, value);
              setError(result.ok ? undefined : result.message);
            });
          }}
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        {pending ? <Spinner /> : null}
      </div>
      <FormMessage ok={false} message={error} />
    </div>
  );
}
