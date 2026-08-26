import { Suspense } from "react";
import { pipelineSummary, readProfileConfig } from "@/lib/career-ops";
import { PipelineViewSwitcher } from "@/components/pipeline-view-switcher";
import { estimateCommuteMiles } from "@/lib/commute-distance.mjs";
import { seedExploreFilters } from "@/lib/core/portals";
import { HumanReviewSources } from "@/components/human-review-sources";

export const dynamic = "force-dynamic"; // always read fresh local files

export default function PipelinePage() {
  const { inbox: rawInbox, applications } = pipelineSummary();
  const { tracks, country, commuteZip } = readProfileConfig();
  const inbox = rawInbox.map((job) => {
    const recorded = job.location?.match(/(?:^|[,·(]\s*)(\d+(?:\.\d+)?)\s*mi\b/i);
    const commuteMiles = recorded ? Number(recorded[1]) : estimateCommuteMiles(job.location, commuteZip);
    return commuteMiles == null ? job : { ...job, commuteMiles, commuteApprox: !recorded };
  });
  return (
    <>
      <div className="mb-4 rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm text-muted">
        <span className="font-medium text-foreground">How to use this page:</span>{" "}
        everything in Inbox is already in Pipeline. Open a prospect → evaluate it to create a scored tracker record → generate its tailored CV → prepare the application. “Shortlist” simply groups prospects for scoring. Email-only prospects show a direct “Prepare email application” action on their detail page. Offerly never sends or submits without you.
      </div>
      <div className="mb-4"><HumanReviewSources roles={seedExploreFilters().filters.positive} /></div>
      <Suspense>
        <PipelineViewSwitcher applications={applications} inbox={inbox} tracks={tracks} country={country} />
      </Suspense>
    </>
  );
}
