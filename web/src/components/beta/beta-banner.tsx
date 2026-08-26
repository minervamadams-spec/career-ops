"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bug, X, ShieldCheck, Loader2, Wrench, CheckCircle2 } from "lucide-react";
import { collect, fixBugContext, type Diag } from "@/lib/report/report";
import { useJobs } from "@/components/jobs/job-store";
import { cachedJson } from "@/lib/client-query";
import "@/lib/report/logbuf"; // install the client error ring-buffer (side-effect)

// Beta/RC differentiator: a small version+channel pill (only on a pre-release
// channel) + a one-click "Report a bug" that has the user's own AI investigate
// and fix it locally — headless, on their machine, through the SAME worker
// system (kind "fix-bug", see api/run/route.ts) every other AI action in this
// app already uses. Replaced the old GitHub-issue flow (2026-08-14): that
// filed real issues against santifer/career-ops, which made sense for the
// upstream project but not for a renamed fork handed to other people, and
// nobody but the maintainer could act on an issue filed there anyway — a
// local fix is something the reporter's own AI can actually do something
// about, immediately.
export function BetaBanner() {
  const [meta, setMeta] = useState<{ version: string; channel: string; sha: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [diag, setDiag] = useState<Diag | null>(null);
  const { jobs, startJob } = useJobs();

  const job = useMemo(
    () => jobs.filter((j) => j.kind === "fix-bug").sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs],
  );

  useEffect(() => {
    cachedJson<{ version: string; channel: string; sha: string }>("version", "/api/version", 300_000)
      .then((d) => {
        if (d?.channel && d.channel !== "stable") setMeta(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const openReport = async () => {
    const d = await collect();
    setDiag(d);
    setOpen(true);
  };

  const submit = () => {
    if (!diag) return;
    startJob({
      title: "Fix bug",
      subtitle: desc.slice(0, 60) || "reported from the app",
      kind: "fix-bug",
      input: fixBugContext(diag, desc),
      page: diag.route,
    });
    setOpen(false);
  };

  if (!meta) return null;

  return (
    <>
      <div className="fixed bottom-3 left-3 z-[70] flex items-center gap-2 rounded-full border border-brand/30 bg-surface/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
        <span className="flex items-center gap-1.5 font-medium text-brand-text">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" /> {meta.version} · {meta.channel}
        </span>
        {meta.sha && <span className="hidden font-mono text-faint sm:inline">{meta.sha}</span>}
        {job?.status === "running" ? (
          <Link href={`/jobs/${job.id}`} className="ml-1 inline-flex items-center justify-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand-text">
            <Loader2 className="size-3 animate-spin" /> Fixing…
          </Link>
        ) : job?.status === "done" ? (
          <Link href={`/jobs/${job.id}`} className="ml-1 inline-flex items-center justify-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3" /> Fixed · view
          </Link>
        ) : (
          <button onClick={openReport} className="ml-1 inline-flex items-center justify-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand-text transition-colors hover:bg-brand/15 max-sm:min-h-[44px]">
            <Bug className="size-3" /> Report a bug
          </button>
        )}
      </div>

      {open && diag && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Report a bug" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-[var(--bg)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <Bug className="size-4 text-brand" />
              <h2 className="text-sm font-semibold text-foreground">Report a bug · {diag.channel}</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="ml-auto text-faint transition-colors hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-2 text-xs text-muted">Describe it, and your own AI will investigate and fix it directly in this checkout — no GitHub, no waiting on anyone.</p>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              autoFocus
              placeholder="What were you doing, and what went wrong?"
              className="w-full resize-none rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
            />
            <details className="mt-3 rounded-lg border border-border bg-surface/40">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted">Exactly what your AI will see — review before sending ↓</summary>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap border-t border-border px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">{fixBugContext(diag, desc)}</pre>
            </details>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-faint">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-emerald-500" /> Stays on your machine — nothing leaves it. NEVER includes your CV, profile, application answers, or job URLs.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={submit}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
              >
                <Wrench className="size-4" /> Fix it locally
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
