"use client";

import { useRouter } from "next/navigation";
import { ClipboardCheck, Lock } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { useApply } from "@/components/apply/apply-provider";

// The "Prepare to apply" CTA. Enabled ONLY when the tailored CV
// for THIS offer is ready (the tracker's PDF column is ✅, or a pdf worker for
// this #n just finished). On click it opens the apply form-proxy for the offer
// (where the user reviews and submits it themselves — never auto-submit).
export function ApplyButton({ n, url, company, pdfReady }: { n: string; url?: string; company: string; pdfReady: boolean }) {
  const router = useRouter();
  const { jobs } = useJobs();
  const apply = useApply();

  const pdfJobDone = jobs.some((j) => j.kind === "pdf" && j.input === n && j.status === "done");
  const hasUrl = !!url && /^https?:\/\//i.test(url);
  const ready = (pdfReady || pdfJobDone) && hasUrl;

  if (!ready) {
    return (
      <button
        type="button"
        disabled
        title={!hasUrl ? "No application URL is available for this role" : "Generate the tailored CV first, then prepare the application"}
        className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-full border border-border bg-surface/40 px-3.5 py-1 text-xs font-medium text-faint max-sm:min-h-[44px]"
      >
        <Lock className="size-3.5" /> {!hasUrl ? "No application link" : "Generate CV first"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        apply.open(url!, { prefill: true, company, n });
        router.push("/apply");
      }}
      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-3.5 py-1 text-xs font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand-200 max-sm:min-h-[44px]"
      title="Prepare the application form — you review and submit it yourself"
    >
      <ClipboardCheck className="size-3.5" /> Prepare to apply
    </button>
  );
}
