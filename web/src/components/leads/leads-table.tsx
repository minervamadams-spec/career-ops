"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, FileText, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useJobs } from "@/components/jobs/job-store";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { scoreTone } from "@/lib/format";
import type { Application } from "@/lib/career-ops";
import { PassReasonPrompt } from "@/components/pass-reason";

type Row = Application & { scoreValue: number };

export function LeadsTable({ top, rest, threshold }: { top: Row[]; rest: Row[]; threshold: number }) {
  const { jobs, startJob } = useJobs();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [showRest, setShowRest] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [askingWhy, setAskingWhy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(() => new Set());

  const toggle = (n: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  const pdfPending = useMemo(() => new Set(jobs.filter((j) => j.kind === "pdf" && j.status === "running").map((j) => String(j.input))), [jobs]);

  const draftSelected = () => {
    for (const row of top) {
      if (!selected.has(row.n) || row.pdf === "✅" || pdfPending.has(row.n)) continue;
      startJob({ title: `CV PDF · ${row.company}`, subtitle: "tailored for this role", kind: "pdf", input: row.n, page: "/leads" });
    }
    setSelected(new Set());
  };

  const setStatus = async (n: string, status: "Applied" | "Discarded", note?: string) => {
    setBusy((b) => new Set(b).add(n));
    try {
      await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, status, ...(note ? { note } : {}) }),
      });
      setDone((d) => new Set(d).add(n));
      router.refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(n);
        return next;
      });
      setAskingWhy(null);
    }
  };

  const selectableCount = top.filter((r) => r.pdf !== "✅" && !pdfPending.has(r.n)).length;

  if (top.length === 0 && rest.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface/30 px-6 py-10 text-center text-sm text-muted">
        No scored roles yet. Evaluate a prospect from your{" "}
        <Link href="/pipeline" className="text-brand hover:underline">
          Pipeline
        </Link>{" "}
        to see it ranked here.
      </div>
    );
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft px-4 py-2.5">
          <span className="text-xs font-medium text-brand-text">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={draftSelected}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground transition hover:bg-brand-200"
          >
            <FileText className="size-3.5" /> Draft tailored resumes for selected
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/60 text-xs uppercase tracking-wide text-faint">
              <th className="w-9 px-3 py-2.5"></th>
              <th className="px-3 py-2.5 font-medium">Score</th>
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Resume</th>
              <th className="px-3 py-2.5 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody>
            {top.map((row) => (
              <LeadRow
                key={row.n}
                row={row}
                selected={selected.has(row.n)}
                selectable={row.pdf !== "✅" && !pdfPending.has(row.n)}
                onToggle={() => toggle(row.n)}
                busy={busy.has(row.n)}
                hidden={done.has(row.n)}
                askingWhy={askingWhy === row.n}
                onSkip={() => setAskingWhy(row.n)}
                onCancelSkip={() => setAskingWhy(null)}
                onConfirmSkip={(reason) => setStatus(row.n, "Discarded", reason ? `Passed: ${reason}` : undefined)}
                onApply={() => setStatus(row.n, "Applied")}
              />
            ))}
          </tbody>
        </table>
      </div>

      {selectableCount === 0 && top.length > 0 && (
        <p className="mt-2 text-xs text-faint">Every top lead already has a tailored resume or one running.</p>
      )}

      {rest.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowRest((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", showRest && "rotate-180")} />
            {showRest ? "Hide" : "Show"} {rest.length} below {threshold.toFixed(1)}
          </button>
          {showRest && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-border opacity-70">
              <table className="w-full min-w-[720px] text-left text-sm">
                <tbody>
                  {rest.map((row) => (
                    <LeadRow
                      key={row.n}
                      row={row}
                      selected={false}
                      selectable={false}
                      onToggle={() => {}}
                      busy={busy.has(row.n)}
                      hidden={done.has(row.n)}
                      askingWhy={askingWhy === row.n}
                      onSkip={() => setAskingWhy(row.n)}
                      onCancelSkip={() => setAskingWhy(null)}
                      onConfirmSkip={(reason) => setStatus(row.n, "Discarded", reason ? `Passed: ${reason}` : undefined)}
                      onApply={() => setStatus(row.n, "Applied")}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeadRow({
  row,
  selected,
  selectable,
  onToggle,
  busy,
  hidden,
  askingWhy,
  onSkip,
  onCancelSkip,
  onConfirmSkip,
  onApply,
}: {
  row: Row;
  selected: boolean;
  selectable: boolean;
  onToggle: () => void;
  busy: boolean;
  hidden: boolean;
  askingWhy: boolean;
  onSkip: () => void;
  onCancelSkip: () => void;
  onConfirmSkip: (reason?: string) => void;
  onApply: () => void;
}) {
  if (hidden) return null;
  const tone = scoreTone(row.score);

  if (askingWhy) {
    return (
      <tr className="border-b border-border last:border-0">
        <td colSpan={7} className="px-3 py-3">
          <PassReasonPrompt company={row.company} busy={busy} onConfirm={onConfirmSkip} onCancel={onCancelSkip} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface/40">
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          onChange={onToggle}
          className="size-4 accent-[var(--brand)] disabled:opacity-30"
          aria-label={`Select ${row.company}`}
        />
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
            tone === "good" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            tone === "warn" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            (tone === "muted" || tone === "bad") && "bg-surface-hover text-muted",
          )}
        >
          {row.score}
        </span>
      </td>
      <td className="px-3 py-3">
        <Link href={`/pipeline/${row.n}`} className="font-medium text-foreground hover:text-brand">
          {row.company}
        </Link>
      </td>
      <td className="max-w-[220px] truncate px-3 py-3 text-muted" title={row.role}>
        {row.role}
      </td>
      <td className="px-3 py-3 text-xs text-faint tabular-nums">{row.date}</td>
      <td className="px-3 py-3">
        <GeneratePdfButton n={row.n} company={row.company} pdfReady={row.pdf === "✅"} />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={onApply}
            className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-brand-text transition hover:bg-brand/15 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Applied
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSkip}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-60"
          >
            <X className="size-3" /> Skip
          </button>
        </div>
      </td>
    </tr>
  );
}
