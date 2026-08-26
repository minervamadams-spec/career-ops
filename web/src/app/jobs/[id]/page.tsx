"use client";

import { use } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, Loader2, Wrench, CircleDot, Check, X, FileText, ChevronDown } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { HeroGlow } from "@/components/hero-glow";
import { Badge } from "@/components/ui/badge";

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { jobs, startJob } = useJobs();
  const job = jobs.find((j) => j.id === id);

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand">
          <ArrowLeft className="size-4" /> Pipeline
        </Link>
        <p className="mt-8 text-sm text-muted">
          This worker is no longer in memory (it finished earlier or the page was reloaded).
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand">
        <ArrowLeft className="size-4" /> Pipeline
      </Link>

      <section className="dot-bg relative mt-5 overflow-hidden rounded-2xl border border-border bg-surface/40 px-6 py-7">
        {job.status === "running" && <HeroGlow />}
        <div className="relative z-10">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-faint">
            {job.status === "running" ? (
              <><Loader2 className="size-3 animate-spin text-brand" /> working</>
            ) : job.status === "done" ? (
              <><Check className="size-3 text-emerald-500" /> done</>
            ) : (
              <><X className="size-3 text-red-400" /> error</>
            )}
          </p>
          <h1 className="mt-2 font-display text-2xl tracking-tight text-landing">{job.title}</h1>
          {job.subtitle && <p className="mt-1 text-sm text-muted">{job.subtitle}</p>}
          {job.result?.score != null && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <Badge tone={job.result.tone}>{job.result.score}/5</Badge>
              {job.result.summary && <span className="text-sm text-muted">{job.result.summary}</span>}
            </div>
          )}
          {job.status === "done" && job.kind === "evaluate" && (
            <div className="mt-5 rounded-xl border border-brand/25 bg-brand-soft/50 p-4">
              <p className="text-sm font-medium text-foreground">Your evaluation is in Pipeline</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Pipeline is Offerly&apos;s application tracker. It contains the score, decision brief, strongest matches, gaps, compensation, risks, and full evidence.
              </p>
              {job.reportId ? (
                <Link href={`/pipeline/${job.reportId}`} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">
                  <FileText className="size-4" /> View evaluation <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link href="/pipeline" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">
                  Open Pipeline <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <details className="group mt-6 rounded-xl border border-border bg-surface/30">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-muted">
          Technical activity · {job.steps.length} steps
          <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
        </summary>
        <ol className="space-y-2 border-t border-border px-4 py-3">
          {job.steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            {s.kind === "tool" ? (
              <Wrench className="mt-0.5 size-3.5 shrink-0 text-brand" />
            ) : (
              <CircleDot className="mt-0.5 size-3.5 shrink-0 text-faint" />
            )}
            <span className={s.kind === "tool" ? "font-medium" : "text-muted"}>
              {s.kind === "tool" ? `Using ${s.label}` : s.label}
            </span>
          </li>
          ))}
        {job.status === "running" && (
          <li className="flex items-center gap-2.5 text-sm text-muted">
            <Loader2 className="size-3.5 animate-spin text-brand" /> thinking…
          </li>
        )}
        </ol>
      </details>

      {job.text && (
        <details className="group mt-4 rounded-xl border border-border bg-surface/30">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-muted">
            Worker transcript
            <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="report-prose border-t border-border px-5 py-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.text}</ReactMarkdown>
          </div>
        </details>
      )}
      {job.status === "error" && job.kind && job.input && (
        <button
          type="button"
          onClick={() => startJob({ title: job.title, subtitle: job.subtitle, kind: job.kind!, input: job.input!, page: job.page, batchId: job.batchId })}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
        >
          Retry in background
        </button>
      )}
    </div>
  );
}
