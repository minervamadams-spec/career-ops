"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Check, Loader2, ShieldQuestion, Sparkles, Coins, X, TriangleAlert, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { instrumentSerif } from "@/lib/fonts";
import { ATS_LABEL, type AtsSource, type DiscoveredOffer } from "@/lib/explore";
import { useJobs } from "@/components/jobs/job-store";
import { JobCardSignals } from "@/components/job-card-signals";
import { useExplore } from "./explore-provider";
import { PassReasonPrompt } from "@/components/pass-reason";
import { useBatchedLogo } from "@/lib/logo-client";

function freshness(postedAt: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) return "";
  const days = Math.max(0, Math.round((Date.now() - new Date(postedAt + "T00:00:00Z").getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
}

// Real company logo (favicon) via the localhost proxy, cached on disk FOREVER per
// company — so once it resolves it's instant for this card AND every other card,
// this search or any future one. Falls back to a monogram on miss.
function Logo({ company }: { company: string }) {
  const { src } = useBatchedLogo(company.trim() ? { kind: "company", value: company } : null);
  const letter = (company || "?").trim().charAt(0).toUpperCase();
  if (!src) {
    return <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-semibold text-brand">{letter}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className="size-9 shrink-0 rounded-lg border border-border bg-surface object-contain p-1"
    />
  );
}

// What a running worker is doing on this exact posting → the live CTA label.
const WORKER_LABEL: Record<string, string> = { evaluate: "Evaluating…", pdf: "Preparing CV…", research: "Researching…", apply: "Filling…" };

export function DiscoveryCard({ offer, inPipeline, evaluatedN, source = "explore" }: { offer: DiscoveredOffer; inPipeline: boolean; evaluatedN?: string; source?: "today" | "explore" }) {
  const { added, adding, addToPipeline, pass } = useExplore();
  const { jobs, startJob } = useJobs();
  const [askingWhy, setAskingWhy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [recordingApplied, setRecordingApplied] = useState(false);

  // GLOBAL worker awareness: any worker acting on this URL drives the CTA, here
  // and on every other surface that renders this offer (the jobs store is global).
  const job = useMemo(
    () => jobs.filter((j) => j.input === offer.url).sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs, offer.url],
  );
  const working = job?.status === "running";
  const doneEval = job?.status === "done" && job.kind === "evaluate";
  // A failed evaluate used to fall straight through to the plain "Evaluate"
  // button with nothing said about why — same silent-swallow bug as
  // GeneratePdfButton. Only for a same-URL "evaluate" job — a failed "pdf" or
  // "research" job on this same offer shouldn't block re-evaluating it.
  const evalError = job?.status === "error" && job.kind === "evaluate" ? job.steps.at(-1)?.label || "Something went wrong evaluating this." : null;
  const statusLabel = WORKER_LABEL[job?.kind ?? ""] ?? "Working…";

  const isAdded = added.has(offer.url) || inPipeline || working || doneEval;
  const isAdding = adding.has(offer.url);
  const unverified = offer.verification === "unconfirmed";
  const fresh = freshness(offer.postedAt) || offer.postedHint || "";

  const evaluate = () => {
    addToPipeline([offer]); // evaluating implies it's in the pipeline — record it
    startJob({ title: `Evaluate · ${offer.company}`, subtitle: offer.title, kind: "evaluate", input: offer.url, page: "/explore" });
  };

  const alreadyApplied = async () => {
    setRecordingApplied(true);
    try {
      const response = await fetch("/api/applications/already-applied", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: offer.company, role: offer.title, url: offer.url }) });
      if (!response.ok) throw new Error("record failed");
      pass(offer, "Already applied elsewhere");
      setDismissed(true);
    } finally { setRecordingApplied(false); }
  };

  if (dismissed) return null;

  if (askingWhy) {
    return <PassReasonPrompt company={offer.company} onConfirm={(reason) => { pass(offer, reason, { source, inPipeline }); setAskingWhy(false); setDismissed(true); }} onCancel={() => setAskingWhy(false)} />;
  }

  const detailHref = `/explore/job?${new URLSearchParams({ url: offer.url, company: offer.company, title: offer.title, location: offer.location || "", ats: offer.ats, posted: offer.postedAt || "", ...(offer.why ? { why: offer.why } : {}), ...(offer.note ? { note: offer.note } : {}), ...(offer.compensation ? { compensation: offer.compensation } : {}), ...(typeof offer.commuteMiles === "number" ? { commute: String(offer.commuteMiles) } : {}), ...(offer.commuteApprox ? { commuteApprox: "1" } : {}) }).toString()}`;

  return (
    <div className="co-rise group flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-surface/40 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <Logo company={offer.company} />
        <Link href={detailHref} className="block min-w-0 flex-1 max-sm:min-h-[44px]">
          <h3 className={`${instrumentSerif.className} truncate text-[17px] leading-tight text-foreground transition-colors group-hover:text-brand`}>{offer.title}</h3>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {offer.company}
            {offer.location && <span className="text-faint"> · {offer.location}</span>}
          </p>
        </Link>
        <a
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open the posting"
          aria-label="Open the posting"
          className="-m-1 inline-flex shrink-0 items-center justify-center rounded p-1 text-faint transition-colors hover:text-foreground max-sm:min-h-[44px] max-sm:min-w-[44px]"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>

      <JobCardSignals
        location={offer.location}
        compensation={offer.compensation}
        commuteMiles={offer.commuteMiles}
        commuteApprox={offer.commuteApprox}
        sourceLabel={ATS_LABEL[offer.ats as AtsSource] ?? offer.ats}
        ageLabel={fresh}
      >
        {unverified && (
          <span
            className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-300"
            title="Found by AI on the public web — we can't confirm it's still live without opening it. Evaluating runs a real browser check and sets the verdict."
          >
            <ShieldQuestion className="size-3" /> unverified
          </span>
        )}
        {offer.matchedKeyword && (
          <span className="text-faint" title="Keyword match — not yet scored. Evaluate to get an A–F fit score.">
            · matched <span className="text-brand/80">{offer.matchedKeyword}</span>
          </span>
        )}
      </JobCardSignals>

      {offer.why && (
        <p className="flex items-start gap-1.5 text-[12px] leading-snug text-brand/80">
          <Sparkles className="mt-0.5 size-3 shrink-0" />
          {offer.why}
        </p>
      )}
      {!offer.why && (
        <p className="text-[12px] leading-snug text-muted">
          {offer.title} at {offer.company}{offer.location ? ` · ${offer.location}` : ""}. Open details for the source, posting age, and next actions.
        </p>
      )}

      <div className="mt-0.5 space-y-2">
        {evaluatedN || doneEval ? (
          <a
            href={evaluatedN ? `/pipeline/${evaluatedN}` : job ? `/jobs/${job.id}` : "/pipeline"}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-soft px-2.5 py-2 text-xs font-medium text-brand max-sm:min-h-[44px]"
          >
            <Check className="size-3.5" /> Evaluated · view report
          </a>
        ) : evalError ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex flex-1 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs font-medium text-red-700 dark:text-red-400">
              <TriangleAlert className="size-3.5 shrink-0" /> {evalError}
            </span>
            <button
              type="button"
              onClick={evaluate}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 py-2 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand max-sm:min-h-[44px]"
            >
              <RotateCcw className="size-3.5" /> Retry
            </button>
          </div>
        ) : working ? (
          <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-brand/30 bg-brand-soft/60 px-2.5 py-2 text-xs font-medium text-brand">
            <Loader2 className="size-3.5 animate-spin" />
            {statusLabel}
            <span className="text-brand/60">· in pipeline</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isAdded || isAdding}
              onClick={() => addToPipeline([offer])}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-xs font-medium transition-colors max-sm:min-h-[44px]",
                isAdded ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-surface-hover text-foreground hover:bg-brand-soft hover:text-brand",
              )}
            >
              {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : isAdded ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              {isAdded ? "In pipeline" : "Add to pipeline"}
            </button>
            <button
              type="button"
              onClick={evaluate}
              title={unverified ? "Runs a real evaluation — and verifies the posting is live. Uses tokens." : "Runs a real A–F evaluation. Uses tokens."}
              className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-brand/30 px-2.5 py-2 text-xs font-medium text-brand transition-colors hover:bg-brand-soft max-sm:min-h-[44px]"
            >
              {inPipeline ? "Evaluate & advance" : "Evaluate"} <Coins className="size-3.5 opacity-80" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setAskingWhy(true)}
          title="Dismiss this match without evaluating it"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-faint transition-colors hover:bg-surface-hover hover:text-foreground max-sm:min-h-[44px]"
        >
          <X className="size-3.5" /> Dismiss · 0 tokens
        </button>
        <button
          type="button"
          onClick={alreadyApplied}
          disabled={recordingApplied}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-60 max-sm:min-h-[44px]"
        >
          {recordingApplied ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Already applied · 0 tokens
        </button>
      </div>
    </div>
  );
}
