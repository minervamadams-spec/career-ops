"use client";

import { useEffect, useState } from "react";

type WeekStats = {
  jobsAddedThisWeek: number;
  applyingDaysThisWeek: number;
  targets: { jobsAddedPerWeek: number; applyingDaysPerWeek: number } | null;
};

function Bar({ value, target, label }: { value: number; target: number; label: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums font-medium text-fg">
          {value}/{target}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Weekly cadence widget — "added N/target this week", "applying N/target days
// this week" — reads /api/stats/week, which reads weekly_targets from
// config/profile.yml (added 2026-08-13). Renders nothing if the user hasn't
// set weekly_targets, rather than showing a 0/0 bar that implies a goal that
// was never actually configured.
export function WeeklyGoalsWidget() {
  const [stats, setStats] = useState<WeekStats | null>(null);

  useEffect(() => {
    fetch("/api/stats/week")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats?.targets) return null;

  return (
    <div className="mb-5 grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface/40 p-4 sm:grid-cols-2">
      <Bar value={stats.jobsAddedThisWeek} target={stats.targets.jobsAddedPerWeek} label="Jobs added this week" />
      <Bar value={stats.applyingDaysThisWeek} target={stats.targets.applyingDaysPerWeek} label="Applying — days this week" />
    </div>
  );
}
