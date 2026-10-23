"use client";

import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/states";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4">
      <ErrorNotice title="Something went wrong">
        <p>
          An unexpected error occurred.
          {error.digest ? <span className="mt-1 block font-mono text-xs text-faint">Reference: {error.digest}</span> : null}
        </p>
      </ErrorNotice>
      <div>
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
