"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/app/actions/auth";
import { initialActionState } from "@/app/actions/types";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-dim">{subtitle}</p>
    </div>
  );
}

const LINK_ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Request a new one.",
};

export function LoginForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(signInAction, initialActionState);
  const notice = params.get("deleted")
    ? "Your account and all of its data were deleted."
    : params.get("error")
      ? LINK_ERRORS[params.get("error") ?? ""] ?? "Something went wrong. Please try again."
      : undefined;

  return (
    <>
      <Heading title="Welcome back" subtitle="Sign in to your private knowledge base." />
      {notice ? (
        <div className="mb-4">
          <FormMessage ok={Boolean(params.get("deleted"))} message={notice} />
        </div>
      ) : null}
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={params.get("next") ?? ""} />
        <Field label="Email" htmlFor="email" error={state.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={state.errors?.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton className="w-full" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-dim hover:text-soft">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-signal hover:underline">
          Create account
        </Link>
      </div>
    </>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialActionState);
  if (state.ok) {
    return (
      <>
        <Heading title="Check your inbox" subtitle="One more step." />
        <FormMessage ok message={state.message} />
        <Link href="/login" className="mt-6 block text-sm text-signal hover:underline">
          Back to sign in
        </Link>
      </>
    );
  }
  return (
    <>
      <Heading title="Create your NEXUS" subtitle="A private second brain. Your memories are visible only to you." />
      <form action={action} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={state.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={state.errors?.password} hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={state.errors?.confirmPassword}>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        </Field>
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton className="w-full" pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-dim">
        Already have an account?{" "}
        <Link href="/login" className="text-signal hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initialActionState);
  return (
    <>
      <Heading title="Reset your password" subtitle="We'll email you a link to choose a new one." />
      {state.ok ? (
        <FormMessage ok message={state.message} />
      ) : (
        <form action={action} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" error={state.errors?.email}>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <FormMessage ok={state.ok} message={state.message} />
          <SubmitButton className="w-full" pendingLabel="Sending…">
            Send reset link
          </SubmitButton>
        </form>
      )}
      <Link href="/login" className="mt-6 block text-center text-sm text-dim hover:text-soft">
        Back to sign in
      </Link>
    </>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, initialActionState);
  return (
    <>
      <Heading title="Choose a new password" subtitle="You'll stay signed in on this device." />
      <form action={action} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password" error={state.errors?.password} hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={state.errors?.confirmPassword}>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        </Field>
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton className="w-full" pendingLabel="Saving…">
          Update password
        </SubmitButton>
      </form>
    </>
  );
}
