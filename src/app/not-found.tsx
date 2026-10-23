import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
      <EmptyState
        icon={<Compass className="h-5 w-5" />}
        title="Nothing here"
        description="This page doesn't exist, or it belongs to data you don't have access to."
        action={
          <ButtonLink href="/overview" variant="secondary">
            Back to overview
          </ButtonLink>
        }
      />
    </main>
  );
}
