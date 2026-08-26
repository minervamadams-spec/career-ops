"use client";

import { useEffect, useState } from "react";
import { Check, CircleDashed, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Cli = { id: string; name: string; run: string; url: string; installed: boolean; path: string | null };
const STORAGE_KEY = "career-ops:config";

// Which CLI a given LLM/provider maps to. Answers a real question: most
// people know "I use ChatGPT" or "I use Claude," not "I have an agentic CLI
// with local file access." ChatGPT specifically needs a callout — the
// chatgpt.com website itself has no local file/shell access, so it can't run
// Offerly at all; OpenAI's answer to that is Codex, their own coding CLI,
// which uses the same OpenAI/ChatGPT account.
const LLM_MAP: { label: string; cliId: string; note?: string }[] = [
  { label: "ChatGPT / OpenAI", cliId: "codex", note: "via Codex, OpenAI's coding CLI — not the chatgpt.com website itself, which has no local file access" },
  { label: "Claude", cliId: "claude" },
  { label: "Gemini / Google", cliId: "gemini" },
  { label: "GitHub Copilot", cliId: "copilot" },
  { label: "Qwen", cliId: "qwen" },
  { label: "Not sure / none yet", cliId: "opencode", note: "OpenCode works with several free models (Qwen, GLM) — no account needed to start" },
];

export function WizardCliStep({ onReady }: { onReady: (ready: boolean) => void }) {
  const [clis, setClis] = useState<Cli[] | null>(null);
  const [cliId, setCliId] = useState("");
  const [llmPicked, setLlmPicked] = useState(false);

  useEffect(() => {
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const list: Cli[] = d.clis ?? [];
        setClis(list);
        setCliId((prev) => prev || list.find((c) => c.installed)?.id || "");
      })
      .catch(() => setClis([]));
  }, []);

  useEffect(() => {
    onReady(!!cliId && !!clis?.find((c) => c.id === cliId)?.installed);
    if (cliId) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "cli", cliId }));
      } catch {
        /* ignore */
      }
    }
  }, [cliId, clis, onReady]);

  const matched = clis?.find((c) => c.id === cliId);
  const matchedNote = LLM_MAP.find((l) => l.cliId === cliId)?.note;

  return (
    <div>
      <h2 className="font-display text-xl text-landing">What AI do you use?</h2>
      <p className="mt-1.5 text-sm text-muted">
        Offerly runs on an AI tool you already have signed in — your own usage, nothing pasted here.
      </p>

      {clis === null ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> Checking what&apos;s on your computer…
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LLM_MAP.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => {
                  setCliId(l.cliId);
                  setLlmPicked(true);
                }}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  llmPicked && cliId === l.cliId ? "border-brand/50 bg-brand-soft text-foreground" : "border-border bg-surface/50 text-muted hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>

          {llmPicked && matched && (
            <div className={cn("mt-4 rounded-xl border px-4 py-3", matched.installed ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
              {matched.installed ? (
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="size-4 shrink-0 text-emerald-500" /> Found <span className="font-medium">{matched.name}</span> on your computer — you&apos;re set.
                </p>
              ) : (
                <div className="text-sm">
                  <p className="flex items-center gap-2 text-foreground">
                    <CircleDashed className="size-4 shrink-0 text-amber-500" /> That needs <span className="font-medium">{matched.name}</span>, which isn&apos;t installed yet.
                  </p>
                  <a href={matched.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand hover:underline">
                    Install it <ExternalLink className="size-3" />
                  </a>
                  <p className="mt-1.5 text-xs text-faint">Then come back to this step — it&apos;ll detect it automatically.</p>
                </div>
              )}
              {matchedNote && <p className="mt-1.5 text-xs text-faint">{matchedNote}</p>}
            </div>
          )}

          <details className="mt-5 rounded-xl border border-border bg-surface/30 p-3">
            <summary className="cursor-pointer select-none text-xs font-medium text-muted">Already know which CLI you have? Pick it directly ↓</summary>
            <div className="mt-3 space-y-2">
              {clis.map((c) => {
                const selected = c.id === cliId;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                      selected ? "border-brand/50 bg-brand-soft" : c.installed ? "border-border bg-surface/50" : "border-border/60 bg-surface/20",
                    )}
                  >
                    {c.installed ? <Check className="size-4 shrink-0 text-emerald-400" /> : <CircleDashed className="size-4 shrink-0 text-faint" />}
                    <button
                      type="button"
                      disabled={!c.installed}
                      onClick={() => {
                        setCliId(c.id);
                        setLlmPicked(false);
                      }}
                      className={cn("flex flex-1 items-center gap-2 text-left max-sm:min-h-[44px]", c.installed ? "" : "cursor-default")}
                    >
                      <span className={cn("font-medium", selected ? "text-foreground" : c.installed ? "" : "text-muted")}>{c.name}</span>
                      <span className="font-mono text-xs text-faint">{c.run}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
