import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Setup required" };

const VARS = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Your Supabase project URL"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "Publishable (or legacy anon) key — safe for the browser"],
  ["AI_PROVIDER_API_KEY", "Groq (free, gsk_…) or Anthropic (sk-ant-…) key for AI answers (server only)"],
  ["EMBEDDING_API_KEY", "Voyage AI or OpenAI key for semantic search (server only)"],
];

/** Shown by the proxy when Supabase environment variables are missing. */
export default function SetupPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-16">
      <Wordmark />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Finish setting up NEXUS</h1>
        <p className="text-sm text-dim">
          This deployment is missing its Supabase configuration, so sign-in and storage are disabled. Add the environment
          variables below (in <code className="font-mono text-soft">.env.local</code> locally, or in your Vercel project
          settings), apply the SQL migration, and redeploy. See <code className="font-mono text-soft">README.md</code> for
          the full checklist.
        </p>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-panel/60">
        {VARS.map(([name, description]) => (
          <li key={name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <code className="font-mono text-sm text-signal-strong">{name}</code>
            <span className="text-sm text-dim">{description}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
