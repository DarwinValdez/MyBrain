"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Mic, MicOff, Plus, Sparkles, Square, TriangleAlert } from "lucide-react";
import {
  appendVoiceTranscriptAction,
  extractFromVoiceSessionAction,
  saveExtractedMemoriesAction,
} from "@/app/actions/voice";
import { TypeBadge } from "@/components/memories/type-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/field";
import { ErrorNotice, FormMessage, Spinner } from "@/components/ui/states";
import type { ExtractedMemory } from "@/lib/ai/extract";
import { cn } from "@/lib/cn";
import { VOICE } from "@/lib/constants";
import { formatSegments, type TranscriptSegment } from "@/lib/voice";

// Minimal Web Speech API typings (not part of TypeScript's DOM lib).
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LANGUAGES = [
  ["es-MX", "Español (México)"],
  ["es-ES", "Español (España)"],
  ["es-US", "Español (EE. UU.)"],
  ["en-US", "English (US)"],
  ["en-GB", "English (UK)"],
  ["pt-BR", "Português (Brasil)"],
  ["fr-FR", "Français"],
] as const;

const AUTOSAVE_MS = 2 * 60 * 1000;
const AUTOSAVE_CHARS = 4000;
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);

const timeFormat = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

type Status = "idle" | "listening" | "restarting" | "stopping";
type Session = { memoryId: string; title: string; length: number };

export function VoiceRecorder({ projects, aiConfigured }: { projects: { id: string; name: string }[]; aiConfigured: boolean }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [lang, setLang] = useState<string>("es-MX");
  const [continuous, setContinuous] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState("");
  const [savedCount, setSavedCount] = useState(0); // segments[0..savedCount) are stored
  const [session, setSession] = useState<Session | null>(null);
  const [saveError, setSaveError] = useState<string>();
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [fatal, setFatal] = useState<string>();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListening = useRef(false);
  const continuousRef = useRef(continuous);
  const restarts = useRef<number[]>([]);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const savingRef = useRef(false);
  const flushAgainRef = useRef(false);
  // Source of truth for recording state, written only from event handlers so
  // speech callbacks and auto-save always see the latest values; the useState
  // copies above exist for rendering.
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const savedCountRef = useRef(0);
  const sessionRef = useRef<Session | null>(null);
  const titleRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Feature detection and language default can only run in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(Boolean(getRecognitionCtor()));
    const preferred = navigator.language;
    const match = LANGUAGES.find(([code]) => code === preferred) ?? LANGUAGES.find(([code]) => code.split("-")[0] === preferred.split("-")[0]);
    if (match) setLang(match[0]);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [segments.length, interim]);

  const unsavedText = segments.slice(savedCount).map((s) => s.text).join(" ");

  /** Store any unsaved segments in the session memory. Safe to call repeatedly. */
  const flush = useCallback(async (): Promise<void> => {
    if (savingRef.current) {
      // A save is in flight; run once more when it finishes so nothing is skipped.
      flushAgainRef.current = true;
      return;
    }
    savingRef.current = true;
    try {
      // Keep saving until everything heard so far is stored (new speech may
      // arrive while a save is in flight), in batches under the size limit.
      do {
        flushAgainRef.current = false;
        const done = savedCountRef.current;
        const pending = segmentsRef.current.slice(done);
        if (!pending.length) break;

        const batch: TranscriptSegment[] = [];
        let size = 0;
        for (const segment of pending) {
          const length = segment.text.length + 14; // "[hh:mm:ss] " + newline
          if (batch.length && size + length > VOICE.maxAppendChars) break;
          batch.push(
            length > VOICE.maxAppendChars ? { ...segment, text: segment.text.slice(0, VOICE.maxAppendChars - 14) } : segment,
          );
          size += length;
        }

        const text = formatSegments(batch, timeFormat);
        if (text) {
          const current = sessionRef.current;
          const result = await appendVoiceTranscriptAction({
            sessionMemoryId: current?.memoryId ?? null,
            title: current?.title ?? titleRef.current,
            text,
          });
          if (!result.ok) {
            setSaveError(result.message);
            break;
          }
          sessionRef.current = result.data;
          setSession(result.data);
          setLastSavedAt(Date.now());
          setSaveError(undefined);
        }
        savedCountRef.current = done + batch.length;
        setSavedCount(savedCountRef.current);
        if (savedCountRef.current < segmentsRef.current.length) flushAgainRef.current = true;
      } while (flushAgainRef.current);
    } catch {
      setSaveError("Couldn't reach the server. The transcript is kept here and will be saved on the next try.");
    } finally {
      savingRef.current = false;
    }
  }, []);

  // Auto-save on a timer and when enough text has piled up.
  useEffect(() => {
    if (status === "idle") return;
    const id = window.setInterval(() => void flush(), AUTOSAVE_MS);
    return () => window.clearInterval(id);
  }, [status, flush]);
  useEffect(() => {
    if (unsavedText.length >= AUTOSAVE_CHARS) void flush();
  }, [unsavedText.length, flush]);

  // Elapsed-time display (keyed on recording vs idle, so reconnects don't reset the tick).
  const isRecording = status !== "idle";
  useEffect(() => {
    if (!isRecording || !startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isRecording, startedAt]);

  // Warn before leaving with unsaved transcript.
  useEffect(() => {
    const hasUnsaved = segments.length > savedCount;
    if (!hasUnsaved && status === "idle") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [segments.length, savedCount, status]);

  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as unknown as { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock && !wakeLock.current) wakeLock.current = await nav.wakeLock.request("screen");
    } catch {
      // Not supported or denied; recording still works.
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && wantListening.current) {
        wakeLock.current = null;
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [acquireWakeLock]);

  const finish = useCallback(() => {
    wantListening.current = false;
    recognitionRef.current = null;
    setInterim("");
    setStatus("idle");
    releaseWakeLock();
    void flush();
  }, [flush, releaseWakeLock]);

  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = "";
      const finals: TranscriptSegment[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          if (text.trim()) finals.push({ at: Date.now(), text: text.trim() });
        } else {
          interimText += text;
        }
      }
      if (finals.length) {
        restarts.current = [];
        segmentsRef.current = [...segmentsRef.current, ...finals];
        setSegments(segmentsRef.current);
      }
      setInterim(interimText);
      setStatus("listening");
    };

    recognition.onerror = (event) => {
      if (FATAL_ERRORS.has(event.error)) {
        setFatal(
          event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "Microphone access was blocked. Allow the microphone for this site in your browser settings and try again."
            : event.error === "audio-capture"
              ? "No microphone was found."
              : "This language isn't supported by your browser's speech recognition.",
        );
        wantListening.current = false;
      }
      // Other errors ("no-speech", "network", "aborted") end the session; onend decides whether to restart.
    };

    recognition.onend = () => {
      setInterim("");
      if (!wantListening.current || !continuousRef.current) {
        finish();
        return;
      }
      // Browsers stop recognition after silence or a time limit; in continuous mode, start again.
      const stamp = Date.now();
      restarts.current = [...restarts.current.filter((t) => stamp - t < 15_000), stamp];
      if (restarts.current.length > 8) {
        setFatal("Speech recognition keeps stopping (check your connection or microphone). Recording paused; what was captured is saved.");
        finish();
        return;
      }
      setStatus("restarting");
      window.setTimeout(() => {
        if (!wantListening.current) return finish();
        try {
          recognition.start(); // the same instance can be restarted after it ends
        } catch {
          finish();
        }
      }, 300);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setStatus("listening");
  }, [lang, finish]);

  function start() {
    setFatal(undefined);
    if (!sessionRef.current && !titleRef.current) {
      const label = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      titleRef.current = `Voice session · ${label}`;
    }
    wantListening.current = true;
    restarts.current = [];
    if (!startedAt) setStartedAt(Date.now());
    setNow(Date.now());
    void acquireWakeLock();
    try {
      startRecognition();
    } catch {
      setFatal("Couldn't start speech recognition. Reload the page and try again.");
      wantListening.current = false;
    }
  }

  function stop() {
    wantListening.current = false;
    setStatus("stopping");
    try {
      recognitionRef.current?.stop();
    } catch {
      finish();
    }
  }

  function newSession() {
    segmentsRef.current = [];
    savedCountRef.current = 0;
    sessionRef.current = null;
    titleRef.current = "";
    setSegments([]);
    setSavedCount(0);
    setSession(null);
    setStartedAt(null);
    setLastSavedAt(null);
    setSaveError(undefined);
    setFatal(undefined);
  }

  const recording = isRecording;
  const elapsed = startedAt && now ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const unsavedCount = segments.length - savedCount;

  if (supported === null) return <Spinner label="Checking microphone support" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        {supported ? (
          <Card className="p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={recording ? stop : start}
                disabled={status === "stopping"}
                aria-pressed={recording}
                className={cn(
                  "relative flex h-20 w-20 shrink-0 items-center justify-center self-center rounded-full border transition-colors",
                  recording
                    ? "border-danger/50 bg-danger-deep/60 text-danger hover:bg-danger-deep"
                    : "border-signal/40 bg-signal text-void shadow-glow hover:bg-signal-strong",
                )}
              >
                {recording ? <Square className="h-7 w-7" aria-hidden /> : <Mic className="h-8 w-8" aria-hidden />}
                {status === "listening" ? (
                  <span className="absolute inset-0 animate-ping rounded-full border border-danger/40" aria-hidden />
                ) : null}
                <span className="sr-only">{recording ? "Stop recording" : "Start recording"}</span>
              </button>
              <div className="min-w-0 flex-1 space-y-3">
                <div aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className={cn("font-medium", recording ? "text-danger" : "text-soft")}>
                    {status === "listening"
                      ? "Listening…"
                      : status === "restarting"
                        ? "Reconnecting…"
                        : status === "stopping"
                          ? "Stopping…"
                          : segments.length
                            ? "Stopped"
                            : "Ready"}
                  </span>
                  {startedAt ? (
                    <span className="font-mono text-xs text-dim">
                      {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:{String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:
                      {String(elapsed % 60).padStart(2, "0")}
                    </span>
                  ) : null}
                  {lastSavedAt ? (
                    <span className="text-xs text-dim">
                      Saved {timeFormat(lastSavedAt)}
                      {unsavedCount ? ` · ${unsavedCount} new line${unsavedCount === 1 ? "" : "s"} pending` : ""}
                    </span>
                  ) : unsavedCount ? (
                    <span className="text-xs text-warn">Not saved yet — auto-saves every 2 minutes</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={lang} onChange={(e) => setLang(e.target.value)} disabled={recording} className="h-9 w-auto text-xs" aria-label="Language">
                    {LANGUAGES.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <label className="flex items-center gap-2 text-sm text-soft">
                    <input type="checkbox" checked={continuous} onChange={(e) => {
                        continuousRef.current = e.target.checked;
                        setContinuous(e.target.checked);
                      }} className="accent-signal" />
                    Record until I stop (no time limit)
                  </label>
                </div>
              </div>
            </div>
            {fatal ? (
              <div className="mt-4">
                <ErrorNotice title="Recording stopped">{fatal}</ErrorNotice>
              </div>
            ) : null}
            {saveError ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-warn" role="alert">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> {saveError}
              </p>
            ) : null}
          </Card>
        ) : (
          <ManualTranscript
            onSaved={(saved) => {
              sessionRef.current = saved;
              setSession(saved);
            }}
          />
        )}

        <Card>
          <CardHeader
            title="Live transcript"
            icon={<Mic className="h-4 w-4 text-signal" aria-hidden />}
            action={
              !recording && (segments.length || session) ? (
                <Button size="sm" variant="ghost" onClick={newSession}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> New session
                </Button>
              ) : null
            }
          />
          <div className="max-h-[50vh] min-h-48 space-y-2 overflow-y-auto px-5 py-4 text-[15px] leading-relaxed">
            {segments.length === 0 && !interim ? (
              <p className="text-sm text-dim">
                {supported ? "Press the microphone and start talking. What you say appears here as text." : "Paste a transcript above to save it."}
              </p>
            ) : null}
            {segments.map((segment, i) => (
              <p key={i} className="flex gap-3 break-words">
                <span className="shrink-0 pt-0.5 font-mono text-[11px] text-faint">{timeFormat(segment.at)}</span>
                <span className={cn(i < savedCount ? "text-soft" : "text-fg")}>{segment.text}</span>
              </p>
            ))}
            {interim ? <p className="pl-[76px] text-dim italic">{interim}</p> : null}
            <div ref={endRef} />
          </div>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="space-y-3 p-5 text-sm">
          <h2 className="font-medium">Saved session</h2>
          {session ? (
            <>
              <Link href={`/memories/${session.memoryId}`} className="block break-words text-signal hover:underline">
                {session.title}
              </Link>
              <p className="text-xs text-dim">{session.length.toLocaleString()} characters saved · searchable in AI Recall</p>
            </>
          ) : (
            <p className="text-dim">The transcript is saved automatically as a memory tagged #voice while you record.</p>
          )}
          {unsavedCount ? (
            <Button size="sm" variant="secondary" onClick={() => void flush()}>
              <Check className="h-3.5 w-3.5" aria-hidden /> Save now
            </Button>
          ) : null}
        </Card>

        <Extraction session={session} recording={recording} flush={flush} projects={projects} aiConfigured={aiConfigured} />

        <p className="px-1 text-xs text-faint">
          Speech is converted to text by your browser. In Chrome and Edge the audio is sent to the browser vendor&apos;s speech service;
          NEXUS never receives or stores audio, only the text. Keep this tab open while recording; on phones, keep the screen on.
        </p>
      </aside>
    </div>
  );
}

function Extraction({
  session,
  recording,
  flush,
  projects,
  aiConfigured,
}: {
  session: Session | null;
  recording: boolean;
  flush: () => Promise<void>;
  projects: { id: string; name: string }[];
  aiConfigured: boolean;
}) {
  const [pending, start] = useTransition();
  const [proposals, setProposals] = useState<ExtractedMemory[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [savedIds, setSavedIds] = useState<string[]>([]);

  function extract() {
    if (!session) return;
    start(async () => {
      setMessage(undefined);
      setSavedIds([]);
      if (recording) await flush();
      const result = await extractFromVoiceSessionAction(session.memoryId);
      if (!result.ok) {
        setMessage({ ok: false, text: result.message });
        return;
      }
      setProposals(result.data);
      setSelected(new Set(result.data.map((_, i) => i)));
      if (!result.data.length) setMessage({ ok: true, text: "Nothing in this transcript looked worth saving as a separate memory." });
    });
  }

  function save() {
    if (!session || !proposals) return;
    const items = proposals.filter((_, i) => selected.has(i));
    if (!items.length) return;
    start(async () => {
      const result = await saveExtractedMemoriesAction(session.memoryId, items, projectId || null);
      if (!result.ok) {
        setMessage({ ok: false, text: result.message });
        return;
      }
      setSavedIds(result.data.ids);
      setProposals(null);
      setMessage({ ok: true, text: `Saved ${result.data.ids.length} memor${result.data.ids.length === 1 ? "y" : "ies"}, linked to this session.` });
    });
  }

  return (
    <Card className="space-y-3 p-5 text-sm">
      <h2 className="flex items-center gap-2 font-medium">
        <Sparkles className="h-4 w-4 text-pulse" aria-hidden /> Extract key information
      </h2>
      <p className="text-xs text-dim">
        AI reads the saved transcript and proposes separate memories (decisions, ideas, facts, tasks). Nothing is saved until you
        choose. Review them: speech recognition makes mistakes.
      </p>
      {!aiConfigured ? <p className="text-xs text-warn">Requires AI_PROVIDER_API_KEY on the server.</p> : null}
      <Button size="sm" variant="secondary" onClick={extract} disabled={!session || pending || !aiConfigured}>
        {pending && !proposals ? <Spinner className="text-current" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
        {proposals ? "Extract again" : "Extract from transcript"}
      </Button>

      {message ? <FormMessage ok={message.ok} message={message.text} /> : null}
      {savedIds.length ? (
        <ul className="space-y-1">
          {savedIds.map((id, i) => (
            <li key={id}>
              <Link href={`/memories/${id}`} className="text-xs text-signal hover:underline">
                Open saved memory {i + 1} →
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {proposals?.length ? (
        <div className="space-y-3 pt-1">
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {proposals.map((item, i) => (
              <li key={i}>
                <label className={cn("block cursor-pointer rounded-lg border p-3", selected.has(i) ? "border-signal/30 bg-signal-deep/15" : "border-line bg-abyss/50 opacity-70")}>
                  <span className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 accent-signal"
                      checked={selected.has(i)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 space-y-1.5">
                      <span className="block font-medium break-words text-fg">{item.title}</span>
                      <span className="block text-xs break-words whitespace-pre-wrap text-dim">{item.content}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <TypeBadge type={item.type} />
                        {item.tags.map((tag) => (
                          <span key={tag} className="text-[11px] text-faint">
                            #{tag}
                          </span>
                        ))}
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="extract-project">Add to project (optional)</Label>
            <Select id="extract-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <Button size="sm" onClick={save} disabled={pending || selected.size === 0} className="w-full">
            {pending ? <Spinner className="text-current" /> : <Check className="h-3.5 w-3.5" aria-hidden />}
            Save {selected.size} selected
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/** Fallback for browsers without speech recognition (e.g. Firefox): paste a transcript. */
function ManualTranscript({ onSaved }: { onSaved: (session: Session) => void }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start gap-3 text-sm">
        <MicOff className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
        <p className="text-dim">
          This browser doesn&apos;t support live speech recognition. Use Chrome, Edge or Safari to record, or paste a transcript
          (for example from your phone&apos;s dictation) below.
        </p>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={VOICE.maxAppendChars} aria-label="Transcript" />
      <FormMessage ok={false} message={error} />
      <Button
        size="sm"
        disabled={pending || !text.trim()}
        onClick={() =>
          start(async () => {
            const label = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
            const result = await appendVoiceTranscriptAction({ sessionMemoryId: null, title: `Voice session · ${label}`, text });
            if (result.ok) {
              onSaved(result.data);
              setText("");
              setError(undefined);
            } else setError(result.message);
          })
        }
      >
        {pending ? <Spinner className="text-current" /> : <Check className="h-3.5 w-3.5" aria-hidden />} Save transcript
      </Button>
    </Card>
  );
}
