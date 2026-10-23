import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";
import { Skeleton } from "@/components/ui/states";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full" />}>
      <LoginForm />
    </Suspense>
  );
}
