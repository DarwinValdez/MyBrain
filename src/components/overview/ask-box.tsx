import { Sparkles } from "lucide-react";

/** Plain GET form into AI Recall, so it works before any JavaScript loads. */
export function AskBox() {
  return (
    <form action="/recall" method="get" className="group relative">
      <label htmlFor="overview-ask" className="sr-only">
        Ask your memories
      </label>
      <Sparkles className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-signal" aria-hidden />
      <input
        id="overview-ask"
        name="q"
        required
        maxLength={4000}
        autoComplete="off"
        placeholder="Ask anything you've saved — “What did I decide about pricing?”"
        className="h-14 w-full rounded-2xl border border-line-strong bg-deep/80 pr-28 pl-12 text-[15px] text-fg shadow-glow placeholder:text-faint focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/20"
      />
      <button
        type="submit"
        className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-xl bg-signal px-4 text-sm font-medium text-void transition-colors hover:bg-signal-strong"
      >
        Recall
      </button>
    </form>
  );
}
