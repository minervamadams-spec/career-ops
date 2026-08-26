import { Suspense } from "react";
import { pipelineSummary } from "@/lib/career-ops";
import { PipelineView } from "@/components/pipeline-view";
import { seedExploreFilters } from "@/lib/core/portals";
import { HumanReviewSources } from "@/components/human-review-sources";

export const dynamic = "force-dynamic"; // always read fresh local files

export default function PipelinePage() {
  const { inbox, applications } = pipelineSummary();
  return (
    <>
      <div className="mb-4"><HumanReviewSources roles={seedExploreFilters().filters.positive} /></div>
      <Suspense>
        <PipelineView applications={applications} inbox={inbox} />
      </Suspense>
    </>
  );
}
