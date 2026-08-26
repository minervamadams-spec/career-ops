"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import type { Application } from "@/lib/career-ops";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/company-logo";
import { canonStatus, scoreTone } from "@/lib/format";
import { cn } from "@/lib/cn";

// Kanban view over the SAME tracker data the table (pipeline-view.tsx) reads —
// no separate data model. Saved/Applying/Applied are derived, not new
// canonical states: Saved = Evaluated, Applied = Applied-or-later, and
// Applying is a plain-text `applying=yes` marker in the Notes cell (see
// /api/board/applying) rather than a new entry in templates/states.yml — a
// real canonical state would touch set-status.mjs validation and every
// script that reads states.yml; this stays additive and low-risk.
const APPLIED_PLUS = new Set(["APPLIED", "RESPONDED", "INTERVIEW", "OFFER", "HIRED"]);

const TRACK_RE = /^track=([A-Za-z0-9]+)\s*(?:—|--)?\s*/i;
const APPLYING_RE = /^applying=yes\s*(?:—|--)?\s*/i;

function parseNotes(notes: string): { track: string | null; applying: boolean; rest: string } {
  let rest = notes ?? "";
  let applying = false;
  const am = rest.match(APPLYING_RE);
  if (am) {
    applying = true;
    rest = rest.slice(am[0].length);
  }
  const tm = rest.match(TRACK_RE);
  const track = tm ? tm[1].toUpperCase() : null;
  if (tm) rest = rest.slice(tm[0].length);
  return { track, applying, rest };
}

type Column = "saved" | "applying" | "applied";

function columnFor(a: Application, applying: boolean): Column | null {
  const status = canonStatus(a.status);
  if (status === "SKIP" || status === "DISCARDED" || status === "REJECTED") return null;
  if (APPLIED_PLUS.has(status)) return "applied";
  if (status === "EVALUATED") return applying ? "applying" : "saved";
  return null;
}

export function BoardView({ applications, tracks }: { applications: Application[]; tracks: Record<string, { label: string }> }) {
  const router = useRouter();
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [pending, setPending] = useState<string | null>(null);

  const trackKeys = useMemo(() => Object.keys(tracks), [tracks]);

  const rows = useMemo(
    () =>
      applications.map((a) => {
        const parsed = parseNotes(a.notes);
        return { app: a, ...parsed, column: columnFor(a, parsed.applying) };
      }),
    [applications],
  );

  const filtered = useMemo(
    () => rows.filter((r) => r.column && (trackFilter === "all" || r.track === trackFilter)),
    [rows, trackFilter],
  );

  const columns: { key: Column; title: string }[] = [
    { key: "saved", title: "Saved" },
    { key: "applying", title: "Applying" },
    { key: "applied", title: "Applied" },
  ];

  const toggleApplying = useCallback(
    async (n: string, applying: boolean) => {
      setPending(n);
      try {
        await fetch("/api/board/applying", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n, applying }),
        });
        router.refresh();
      } finally {
        setPending(null);
      }
    },
    [router],
  );

  return (
    <div>
      {trackKeys.length > 0 && (
        <div className="mb-5 flex items-center gap-1.5">
          <button
            onClick={() => setTrackFilter("all")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              trackFilter === "all" ? "bg-brand text-brand-foreground" : "bg-surface-hover text-muted hover:text-fg",
            )}
          >
            All
          </button>
          {trackKeys.map((k) => (
            <button
              key={k}
              onClick={() => setTrackFilter(k)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                trackFilter === k ? "bg-brand text-brand-foreground" : "bg-surface-hover text-muted hover:text-fg",
              )}
            >
              {tracks[k]?.label ?? k}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map((col) => {
          const items = filtered.filter((r) => r.column === col.key);
          return (
            <div key={col.key} className="rounded-xl border border-border bg-surface/40 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-fg">{col.title}</h3>
                <span className="tabular-nums text-xs text-faint">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-faint">No jobs here</p>}
                {items.map(({ app, track, rest }) => (
                  <div key={app.n} className="rounded-lg border border-border bg-surface p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <CompanyLogo name={app.company} size={18} />
                        <Link href={`/pipeline/${app.n}`} className="truncate text-sm font-medium text-fg hover:text-brand">
                          {app.company}
                        </Link>
                      </div>
                      <Badge tone={scoreTone(app.score)}>{app.score || "—"}</Badge>
                    </div>
                    <Link href={`/pipeline/${app.n}`} className="mt-1 block truncate text-sm text-muted hover:text-brand">
                      {app.role}
                    </Link>
                    <div className="mt-2 flex items-center gap-1.5">
                      {track && tracks[track] && (
                        <Badge tone="info" className="normal-case">
                          {tracks[track].label}
                        </Badge>
                      )}
                      {rest && <span className="truncate text-xs text-faint">{rest}</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {col.key === "saved" && (
                        <button
                          onClick={async () => {
                            await toggleApplying(app.n, true);
                            router.push(`/pipeline/${app.n}`);
                          }}
                          disabled={pending === app.n}
                          className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-1 text-xs font-medium text-fg hover:bg-border disabled:opacity-50"
                        >
                          {pending === app.n ? <Loader2 className="size-3 animate-spin" /> : null}
                          Prepare to apply
                        </button>
                      )}
                      {col.key === "applying" && (
                        <button
                          onClick={() => toggleApplying(app.n, false)}
                          disabled={pending === app.n}
                          className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-1 text-xs font-medium text-fg hover:bg-border disabled:opacity-50"
                        >
                          {pending === app.n ? <Loader2 className="size-3 animate-spin" /> : null}
                          Back to saved
                        </button>
                      )}
                      <Link
                        href={`/pipeline/${app.n}`}
                        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                      >
                        Open <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
