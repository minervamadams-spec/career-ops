"use client";

import { useState } from "react";
import { Check, Loader2, MessagesSquare } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

// AGENTS.md's own onboarding Step 5 ("Get to know the user") lived only as
// something a CLI session asks conversationally — this brings the same 5
// questions onto the site so answering them doesn't depend on happening to
// be mid-chat with an agent. Answers land in the SAME files that step
// documents (config/profile.yml narrative, modes/_profile.md, article-
// digest.md) via kind "intake" — never cv.md, never modes/_shared.md.
const QUESTIONS = [
  { key: "superpower", label: "What makes you unique? What's your \"superpower\" other candidates don't have?" },
  { key: "excites", label: "What kind of work excites you? What drains you?" },
  { key: "dealbreakers", label: "Any deal-breakers? (e.g. no on-site, no startups under 20 people, no Java shops)" },
  { key: "achievement", label: "Your best professional achievement — the one you'd lead with in an interview" },
  { key: "published", label: "Any projects, articles, or case studies you've published?" },
] as const;

export function IntakeQuestions() {
  const { jobs, startJob } = useJobs();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [runId, setRunId] = useState<string | null>(null);
  const job = jobs.find((j) => j.id === runId);
  const busy = job?.status === "running";
  const anyAnswered = Object.values(answers).some((v) => v.trim());

  const save = () => {
    const block = QUESTIONS.filter((q) => answers[q.key]?.trim())
      .map((q) => `Q: ${q.label}\nA: ${answers[q.key].trim().slice(0, 2000)}`)
      .join("\n\n");
    if (!block) return;
    const id = startJob({ title: "Get to know you", subtitle: "personalizing your profile", kind: "intake", input: block, page: "/cv" });
    setRunId(id);
  };

  const summary = job?.text.match(/VERDICT:\s*[\d.]+\s*\/\s*5\s*[—:|-]+\s*(.+)/i)?.[1]?.trim();

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface/30 p-5">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <MessagesSquare className="size-4 text-brand" /> Get to know you
      </p>
      <p className="mt-0.5 text-xs text-muted">
        The system scores and writes better when it knows you well — answer any of these (skip what doesn't apply) and I'll fold them into your profile.
      </p>

      <div className="mt-4 space-y-3.5">
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <label className="mb-1 block text-xs font-medium text-foreground">{q.label}</label>
            <textarea
              value={answers[q.key] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
              disabled={busy}
              rows={2}
              placeholder="Optional — skip if it doesn't apply"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/40 disabled:opacity-60"
            />
          </div>
        ))}
      </div>

      {job?.status === "error" && <p className="mt-3 text-xs text-red-600">{job.text || "Couldn't save this — try again."}</p>}
      {job?.status === "done" && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="size-3.5" /> Saved{summary ? ` — ${summary}` : ""}
        </p>
      )}

      <button
        type="button"
        disabled={!anyAnswered || busy}
        onClick={save}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3.5 py-1.5 text-xs font-medium text-brand-text transition hover:bg-brand/15 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        {busy ? "Saving…" : "Save & personalize"} <CostBadge kind="spend" size="xs" />
      </button>
    </section>
  );
}
