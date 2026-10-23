import { Brain, Lock, Network, Sparkles } from "lucide-react";
import { NeuralBackdrop } from "@/components/brand/neural-backdrop";
import { Wordmark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

const FEATURES = [
  { icon: Brain, title: "Capture in seconds", body: "Ideas, decisions, research and references — typed, tagged and tied to projects." },
  { icon: Sparkles, title: "Recall with sources", body: "Ask in plain language. Answers cite the exact memories they came from, and say when they don't know." },
  { icon: Network, title: "See the connections", body: "A knowledge graph of memories, projects and concepts. AI links are suggestions until you accept them." },
  { icon: Lock, title: "Private by default", body: "Row-level security on every table. Export or delete everything, any time." },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <NeuralBackdrop className="absolute inset-x-0 top-0 h-[70vh] w-full opacity-80" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <div className="flex gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            Get started
          </ButtonLink>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <section className="mx-auto max-w-3xl pt-20 pb-16 text-center sm:pt-28">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal/80">Personal knowledge system</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Everything you learn, think, and build —{" "}
            <span className="bg-gradient-to-r from-signal-strong to-pulse bg-clip-text text-transparent">connected</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-dim sm:text-lg">
            NEXUS is a private second brain. Save what matters, then ask questions and get answers grounded in your own
            notes, with citations.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/signup" size="lg">
              Create your NEXUS
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              Sign in
            </ButtonLink>
          </div>
        </section>
        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-line bg-panel/50 p-5 backdrop-blur-sm">
              <Icon className="h-5 w-5 text-signal" aria-hidden />
              <h2 className="mt-4 text-sm font-medium">{title}</h2>
              <p className="mt-1.5 text-sm text-dim">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
