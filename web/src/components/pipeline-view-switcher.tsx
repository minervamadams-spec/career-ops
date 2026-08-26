"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Application, InboxJob } from "@/lib/career-ops";
import { PipelineView } from "@/components/pipeline-view";
import { BoardView } from "@/components/board-view";
import { WeeklyGoalsWidget } from "@/components/weekly-goals-widget";
import { cn } from "@/lib/cn";

// Board and Table are two views over the same tracker data — same pattern as
// the existing tab/sort/min URL-param state in pipeline-view.tsx, so a
// deep link (e.g. from the daily-scan email) can point straight at either.
export function PipelineViewSwitcher({
  applications,
  inbox,
  tracks,
  country,
}: {
  applications: Application[];
  inbox: InboxJob[];
  tracks: Record<string, { label: string }>;
  country: string | null;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = params.get("view") === "board" ? "board" : "table";

  const setView = (v: "board" | "table") => {
    const sp = new URLSearchParams(params.toString());
    if (v === "table") sp.delete("view");
    else sp.set("view", v);
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5">
          {(["board", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                view === v ? "bg-brand text-brand-foreground" : "text-muted hover:text-fg",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <Link
          href="/pipeline/add"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Plus className="size-3.5" /> Add job
        </Link>
      </div>

      {view === "board" ? (
        <>
          <WeeklyGoalsWidget />
          <BoardView applications={applications} tracks={tracks} />
        </>
      ) : (
        <PipelineView applications={applications} inbox={inbox} country={country} />
      )}
    </div>
  );
}
