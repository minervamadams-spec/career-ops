"use client";

import { useState } from "react";
import { List, Loader2, RotateCcw } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

// "Act as a senior recruiter — list the top 20 titles I'm qualified for and
// the exact ATS keywords" — read-only analysis of cv.md, no artifact file:
// the streamed job text (job-store.tsx caps it at 8000 chars, plenty for a
// 20-line list) IS the result, same as the "research" kind already works.
export function TitleKeywordsPanel() {
  const { jobs, startJob } = useJobs();
  const [runId, setRunId] = useState<string | null>(null);
  const job = jobs.find((j) => j.id === runId);

  const generate = () => {
    const id = startJob({ title: "Titles & ATS keywords", subtitle: "recruiter's read on your resume", kind: "keywords", input: "cv.md", page: "/cv" });
    setRunId(id);
  };

  const text = job?.text.replace(/\n?VERDICT:[^\n]*$/i, "").trim();

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <List className="size-4 text-brand" /> Titles &amp; ATS keywords
          </p>
          <p className="mt-0.5 text-xs text-muted">A recruiter's read on your resume: your top 20 job titles, ranked by real fit, with the keywords each one should carry.</p>
        </div>
      </div>

      {job?.status === "running" && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
          <Loader2 className="size-3.5 animate-spin" /> Reading your resume…
        </p>
      )}

      {job?.status === "error" && <p className="mt-3 text-xs text-red-600">{job.text || "Couldn't generate this — try again."}</p>}

      {job?.status === "done" && text && (
        <div className="mt-3">
          <pre className="report-prose whitespace-pre-wrap rounded-xl border border-border bg-surface/50 p-3.5 font-sans text-xs leading-relaxed text-foreground">{text}</pre>
          <button type="button" onClick={generate} className="mt-2 inline-flex items-center gap-1 text-[11px] text-faint hover:text-brand">
            <RotateCcw className="size-3" /> Regenerate
          </button>
        </div>
      )}

      {(!job || (job.status !== "running" && job.status !== "done")) && (
        <button
          type="button"
          onClick={generate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand"
        >
          <List className="size-3.5" /> Find my top titles &amp; keywords <CostBadge kind="spend" size="xs" />
        </button>
      )}
    </section>
  );
}
