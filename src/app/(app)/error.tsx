"use client";

import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/states";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <ErrorNotice title="This page couldn't load">
        <p>
          Something went wrong while loading your data. Your memories are safe; try again in a moment.
          {error.digest ? <span className="mt-1 block font-mono text-xs text-faint">Reference: {error.digest}</span> : null}
        </p>
      </ErrorNotice>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
