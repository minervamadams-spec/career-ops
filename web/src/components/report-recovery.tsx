"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

export function ReportRecovery({ company, role, url }: { company: string; role: string; url: string | null }) {
  const { jobs, startJob } = useJobs();
  const autoStarted = useRef(false);
  const job = url ? jobs.filter((j) => j.kind === "evaluate" && j.input === url).sort((a, b) => b.startedAt - a.startedAt)[0] : null;
  const running = job?.status === "running";

  useEffect(() => {
    if (!url || job || autoStarted.current) return;
    const key = `career-ops:auto-eval:${url}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, new Date().toISOString());
    } catch {
      // Storage unavailable: the ref still prevents a Strict Mode duplicate.
    }
    autoStarted.current = true;
    startJob({ title: `Score · ${company}`, subtitle: role, kind: "evaluate", input: url, page: "/pipeline" });
  }, [company, job, role, startJob, url]);

  return (
    <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <h2 className="font-medium text-foreground">This entry only has a scan summary</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        The scan saved the score and tracker row. The detailed evaluation now runs in the background the first time you open this page, so you can leave and come back.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {url ? (
          <>
            <button
              type="button"
              disabled={running}
              onClick={() => startJob({ title: `Score · ${company}`, subtitle: role, kind: "evaluate", input: url, page: "/pipeline" })}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-60"
            >
              {running ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {running ? "Running full evaluation in background…" : job?.status === "error" ? "Retry full evaluation" : "Run full evaluation"}
            </button>
            <CostBadge kind="spend" size="xs" />
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 text-xs text-brand hover:underline">
              Open original posting <ExternalLink className="size-3" />
            </a>
          </>
        ) : (
          <p className="text-xs text-muted">The original posting URL was not retained, so this entry needs to be evaluated again from Pipeline.</p>
        )}
      </div>
    </div>
  );
}
