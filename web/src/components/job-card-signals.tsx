import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { workArrangementFromLocation } from "@/lib/format";

export type JobCardSignalProps = {
  location?: string;
  compensation?: string;
  commuteMiles?: number;
  commuteApprox?: boolean;
  sourceLabel?: string;
  ageLabel?: string;
  children?: ReactNode;
  className?: string;
};

/** Canonical metadata strip for every raw-job card surface. Keep location,
 * work arrangement, commute, compensation, source, and age together so a new
 * card variant cannot accidentally drop decision-critical signals. */
export function JobCardSignals({
  location = "",
  compensation,
  commuteMiles,
  commuteApprox,
  sourceLabel,
  ageLabel,
  children,
  className,
}: JobCardSignalProps) {
  const hasMiles = typeof commuteMiles === "number" && Number.isFinite(commuteMiles);
  // A commute estimate only exists for a concrete workplace location (the
  // estimator deliberately returns null for Remote/Hybrid). Treat that as an
  // on-site signal instead of showing distance with no arrangement label.
  const arrangement = workArrangementFromLocation(location) ?? (hasMiles ? "On-site" : null);
  const commuteLabel = hasMiles ? `${commuteApprox ? "≈" : ""}${commuteMiles} mi commute` : null;

  return (
    <div className={cn("space-y-1.5", className)} data-job-card-signals>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {sourceLabel && <span className="rounded border border-border px-1.5 py-0.5 font-medium text-muted">{sourceLabel}</span>}
        {arrangement && (
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 font-medium",
              arrangement === "Remote" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              arrangement === "Hybrid" && "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
              arrangement === "On-site" && "border-border text-muted",
            )}
          >
            {arrangement}
          </span>
        )}
        {commuteLabel && arrangement !== "Remote" && (
          <span className="rounded border border-border px-1.5 py-0.5 font-medium text-muted">{commuteLabel}</span>
        )}
        {ageLabel && <span className="text-faint">{ageLabel}</span>}
        {children}
      </div>
      {location && <p className="truncate text-[11px] text-faint" title={location}>{location}</p>}
      {compensation && <p className="text-[12px] font-medium text-foreground">{compensation}</p>}
    </div>
  );
}
