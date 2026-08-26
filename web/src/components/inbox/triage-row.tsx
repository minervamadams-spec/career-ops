"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Loader2, X, Eye } from "lucide-react";
import type { InboxJob } from "@/lib/career-ops";
import type { AtsSource } from "@/lib/explore";
import { ATS_LABEL } from "@/lib/explore";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/company-logo";
import { PassReasonPrompt } from "@/components/pass-reason";
import { JobCardSignals } from "@/components/job-card-signals";
import { cn } from "@/lib/cn";

export type RowScore = { score: number | null; tone: "good" | "warn" | "bad" | "muted"; jobId: string; running: boolean };

function agoLabel(age: number | null): string | null {
  if (age == null) return null;
  if (age <= 0) return "today";
  if (age === 1) return "yesterday";
  if (age < 7) return `${age}d ago`;
  if (age < 30) return `${Math.floor(age / 7)}w ago`;
  return `${Math.floor(age / 30)}mo ago`;
}

// One raw posting in the triage list. Shows ONLY cheap, free signals + an honest
// "not scored" (CRUDA) — never a fake match%. Once its shortlist eval finishes it
// flips to EVALUADA (a real A–F badge). Save→shortlist / Skip→hidden are free + undoable.
export function TriageRow({
  job,
  source,
  age,
  scored,
  selected,
  shortlisted,
  onToggleSelect,
  onSave,
  onSkip,
}: {
  job: InboxJob;
  source: AtsSource | null;
  age: number | null;
  scored?: RowScore;
  selected: boolean;
  shortlisted: boolean;
  onToggleSelect: () => void;
  onSave: () => void;
  onSkip: (reason?: string) => void;
}) {
  const ago = agoLabel(age);
  const evaluated = !!scored && (scored.running || scored.score != null);
  const [askingWhy, setAskingWhy] = useState(false);

  if (askingWhy) {
    return (
      <li className="px-3 py-2.5 sm:px-4">
        <PassReasonPrompt company={job.company} onConfirm={(reason) => onSkip(reason)} onCancel={() => setAskingWhy(false)} />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-2.5 px-3 py-3 transition-colors sm:gap-3 sm:px-4",
        selected ? "bg-brand-soft/50" : "hover:bg-surface-hover",
        evaluated && "opacity-95",
      )}
    >
      {/* multi-select — power-user batch to shortlist */}
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select ${job.company} ${job.role}`}
        className="size-4 shrink-0 accent-brand max-sm:min-h-[44px] max-sm:min-w-[24px]"
      />

      <CompanyLogo name={job.company} size={20} />

      <div className="min-w-0">
        <p className="truncate text-sm">
          <span className="font-medium text-foreground">{job.company}</span>
          <span className="text-muted"> · {job.role}</span>
        </p>
        <JobCardSignals
          className="mt-1.5"
          location={job.location}
          compensation={job.compensation}
          commuteMiles={job.commuteMiles}
          commuteApprox={job.commuteApprox}
          sourceLabel={source ? ATS_LABEL[source] : undefined}
          ageLabel={ago ?? undefined}
        >
          <span className="font-medium text-brand/80">In pipeline</span>
          {!evaluated && <span className="italic text-muted">not scored</span>}
        </JobCardSignals>

        <div className="mt-2 flex flex-wrap items-center gap-1.5" data-job-card-actions>
          {evaluated && (
            <Link href={`/jobs/${scored!.jobId}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-brand-soft px-2.5 text-xs font-medium text-brand">
              {scored!.running ? <><Loader2 className="size-3.5 animate-spin" /> Scoring…</> : <Badge tone={scored!.tone}>{scored!.score}/5</Badge>}
            </Link>
          )}
          <Link
            href={`/pipeline/inbox?url=${encodeURIComponent(job.url)}`}
            title="View prospect details and application options"
            className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-brand max-sm:min-h-[44px]"
          >
            <Eye className="size-4" /><span className="max-sm:hidden">View</span>
          </Link>
          {!evaluated && <button
            type="button"
            onClick={onSave}
            title={shortlisted ? "In your scoring shortlist" : "Shortlist for scoring"}
            aria-pressed={shortlisted}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors max-sm:min-h-[44px] max-sm:min-w-[44px]",
              shortlisted ? "text-brand" : "text-muted hover:bg-surface-hover hover:text-brand",
            )}
          >
            {shortlisted ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
            <span className="max-sm:hidden">{shortlisted ? "Shortlisted" : "Shortlist"}</span>
          </button>}
          <button
            type="button"
            onClick={() => setAskingWhy(true)}
            title="Dismiss — remove from the inbox"
            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md px-2.5 text-xs text-faint transition-colors hover:bg-surface-hover hover:text-foreground max-sm:min-h-[44px]"
          >
            <X className="size-4" /> Dismiss
          </button>
        </div>
      </div>
    </li>
  );
}
