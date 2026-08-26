import { pipelineSummary, doctorState } from "@/lib/career-ops";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { SetupWizard } from "@/components/wizard/setup-wizard";
import { TodayDashboard } from "@/components/home/today-dashboard";

export const dynamic = "force-dynamic"; // always read fresh local files at request time (never at build — CI has no user data)

export default function Home() {
  const { phase, onboardingNeeded } = doctorState();
  // First run (truly empty install): the full setup wizard IS the home — AI
  // engine -> CV -> profile -> job sources -> review, before any commitment.
  // Replaced the old bare CV-upload takeover (FirstRunHome) 2026-08-13 so a
  // fresh checkout someone else runs actually gets a real onboarding flow
  // instead of landing on an empty dashboard. The full dashboard returns once
  // they have a CV or any data.
  if (phase === "first-run") return <SetupWizard />;

  const { inbox, applications } = pipelineSummary();
  // Seed the client component with the exact string rendered on the server.
  // Reading the browser clock during its first render can cross midnight (or a
  // timezone boundary) and change the hydration tree.
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  // Established / in-between: the dual-loop retention dashboard. Show the setup
  // banner whenever ANY prereq is missing (mirrors the core doctor.mjs), so a
  // portals-missing user is nudged rather than told "all caught up".
  return (
    <>
      {onboardingNeeded && <OnboardingBanner />}
      <TodayDashboard applications={applications} inbox={inbox} inBetween={phase === "in-between"} initialDateLabel={dateLabel} />
    </>
  );
}
