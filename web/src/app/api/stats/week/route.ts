import { NextResponse } from "next/server";
import { pipelineSummary, readProfileConfig } from "@/lib/career-ops";
import { canonStatus } from "@/lib/format";

// Current ISO week (Monday–Sunday) containing `now`, as {from, to} YYYY-MM-DD
// strings — same convention stats.mjs/weekly-digest.mjs use on the core side.
function isoWeekRange(now: Date): { from: string; to: string } {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() - day + 1); // back to Monday
  const from = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

const APPLIED_PLUS = new Set(["APPLIED", "RESPONDED", "INTERVIEW", "OFFER", "HIRED"]);

// Weekly rollup for the board's goal widget: jobs added this week (any status,
// by tracker date) and DISTINCT DAYS this week with at least one row moved to
// Applied+ (by tracker date). The latter is a proxy, not a true event log — a
// row's `date` column is when it was added to the tracker, not necessarily the
// exact day the status flipped to Applied. Good enough for a weekly cadence
// widget; a real event log would be a bigger change (see AGENTS.md's Data
// Contract before adding one).
export async function GET() {
  const { applications } = pipelineSummary();
  const { from, to } = isoWeekRange(new Date());

  const thisWeek = applications.filter((a) => a.date >= from && a.date <= to);
  const jobsAddedThisWeek = thisWeek.length;
  const applyingDaySet = new Set(thisWeek.filter((a) => APPLIED_PLUS.has(canonStatus(a.status))).map((a) => a.date));

  const { weeklyTargets, tracks } = readProfileConfig();

  return NextResponse.json({
    weekOf: from,
    jobsAddedThisWeek,
    applyingDaysThisWeek: applyingDaySet.size,
    targets: weeklyTargets,
    tracks,
  });
}
