"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ArrowRight } from "lucide-react";
import type { ProfileStepResult } from "./wizard-profile-step";
import type { SourcesStepResult } from "./wizard-sources-step";

function buildDailyScanPrompt(profile: ProfileStepResult, sources: SourcesStepResult, checkoutPath: string): string {
  const rolesList = profile.roles.map((r) => `- search="${r}", location="${profile.location || "remote"}", country_code="US"`).join("\n");
  const sourceLines = [
    sources.indeed ? "- Indeed human-review link in Offerly (opens a pre-filled search; review results manually)" : null,
    sources.webSearch ? "- WebSearch (Google-indexed job boards/company pages)" : null,
    "- node scan.mjs (zero-token portal scanner over portals.yml's tracked_companies)",
  ]
    .filter(Boolean)
    .join("\n");

  return `Set up a daily automated job search scan for me. Create a scheduled task (use your scheduled-tasks tool) that runs every morning and does the following:

## Working directory
${checkoutPath}

## Sources to search
${sourceLines}

## Step 1 — zero-token portal scan (always run)
\`\`\`bash
cd ${checkoutPath} && node scan.mjs
\`\`\`
Read data/pipeline.md for URLs found.

${sources.indeed ? `## Step 2 — Indeed human review\nOfferly's Pipeline includes a pre-filled Indeed search for these roles:\n${rolesList}\nOpen that link, review the results manually, and add only relevant postings to Pipeline. Do not run an automated Indeed scraper or paid actor.\n` : ""}
## Step 3 — Evaluate matches
Score each against my profile (config/profile.yml): target roles are ${profile.roles.join(", ")}${profile.location ? `, based in/around ${profile.location}` : ""}. Score 1.0-5.0. Include everything ≥3.5, or that's an exceptional fit regardless of score.

## Step 4 — Write every match into the live tracker (don't just email a digest)
1. \`node reserve-report-num.mjs --count {N}\` for N matches.
2. Write one TSV per match to \`batch/tracker-additions/{num}-{company-slug}.tsv\`:
   \`{num}\\t{today YYYY-MM-DD}\\t{company}\\t{role}\\tEvaluated\\t{score}/5\\t❌\\t—\\t{one-line note}\`
3. \`node merge-tracker.mjs\` once, covering the whole batch.

## Step 5 — Email/notify me a summary
Ranked list of today's matches, with a note on any tier skipped for budget reasons.

## Step 6 — Save dedup history
Append every evaluated job (matched or rejected) to data/scan-history.tsv so it's never re-shown.

Run this every morning around 9am. Always reach steps 4-6 even if you had to stop early on step 2/3 for budget — a partial scan that ships beats a full one that never finishes.`;
}

export function WizardReviewStep({
  profile,
  sources,
  checkoutPath,
}: {
  profile: ProfileStepResult;
  sources: SourcesStepResult;
  checkoutPath: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const prompt = buildDailyScanPrompt(profile, sources, checkoutPath);

  const copy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <h2 className="font-display text-xl text-landing">You&apos;re set up</h2>
      <p className="mt-1.5 text-sm text-muted">Here&apos;s what got created, and one more step to fully automate it.</p>

      <ul className="mt-5 flex flex-col gap-2">
        <SummaryRow label="CV" detail="cv.md saved" />
        <SummaryRow label="Profile" detail={`${profile.roles.join(", ")}${profile.location ? ` · ${profile.location}` : ""}`} />
        <SummaryRow
          label="Sources"
          detail={[sources.indeed && "Indeed", sources.webSearch && "Web search", sources.companies.length > 0 && `${sources.companies.length} companies`].filter(Boolean).join(", ") || "None selected"}
        />
      </ul>

      <div className="mt-6 rounded-xl border border-border bg-surface/30 p-4">
        <p className="text-sm font-medium text-foreground">Last step: turn on the daily automated scan</p>
        <p className="mt-1 text-xs text-muted">
          This part needs your own AI session (it creates a scheduled task on your account, not something this page can
          do for you). Copy this and paste it to your AI CLI:
        </p>
        <div className="relative mt-3">
          <pre className="max-h-52 overflow-auto rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">{prompt}</pre>
          <button
            onClick={copy}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-1 text-[11px] font-medium text-fg hover:bg-border"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <button
        onClick={() => router.push("/")}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
      >
        Go to dashboard <ArrowRight className="size-3.5" />
      </button>
    </div>
  );
}

function SummaryRow({ label, detail }: { label: string; detail: string }) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm">
      <Check className="size-3.5 shrink-0 text-emerald-500" />
      <span className="font-medium text-foreground">{label}</span>
      <span className="truncate text-xs text-faint">{detail}</span>
    </li>
  );
}
