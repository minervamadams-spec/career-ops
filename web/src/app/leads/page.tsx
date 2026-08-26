import { pipelineSummary } from "@/lib/career-ops";
import { scoreNum } from "@/lib/format";
import { LeadsTable } from "@/components/leads/leads-table";

export const dynamic = "force-dynamic"; // always read fresh local files

// "Top Leads" — a durable, on-site view over the scored tracker, distinct from
// Pipeline's raw firehose. AGENTS.md's own ethical-use rule already draws the
// line for what's worth sending out for: "below 4.0/5, explicitly recommend
// against applying." This page just makes that threshold visible as a table
// instead of leaving it buried in evaluation prose.
const TOP_THRESHOLD = 4.0;

export default function LeadsPage() {
  const { applications } = pipelineSummary();
  const evaluated = applications
    .filter((a) => /^evaluat/i.test(a.status))
    .map((a) => ({ ...a, scoreValue: scoreNum(a.score) }))
    .sort((a, b) => (Number.isNaN(b.scoreValue) ? -1 : b.scoreValue) - (Number.isNaN(a.scoreValue) ? -1 : a.scoreValue));

  const top = evaluated.filter((a) => !Number.isNaN(a.scoreValue) && a.scoreValue >= TOP_THRESHOLD);
  const rest = evaluated.filter((a) => Number.isNaN(a.scoreValue) || a.scoreValue < TOP_THRESHOLD);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 max-sm:pb-24">
      <div className="mb-1 flex items-baseline gap-2">
        <h1 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Top Leads</h1>
      </div>
      <p className="mb-6 max-w-xl text-sm text-muted">
        Scored roles worth sending out for — {TOP_THRESHOLD.toFixed(1)}+ by default, ranked highest first. Select any and draft a tailored resume for all of them in one go; nothing gets sent anywhere without you.
      </p>

      <LeadsTable top={top} rest={rest} threshold={TOP_THRESHOLD} />
    </div>
  );
}
