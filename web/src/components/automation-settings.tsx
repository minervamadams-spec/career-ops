"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

// Daily-scan time preference → config/profile.yml → automation.daily_scan_time
// (see api/automation/schedule/route.ts). Honest about the mechanism: saving
// here does NOT instantly retime the real scheduled task — that lives in
// Claude's own account-level scheduler, reachable only from an interactive
// Claude Code session, never from this app's own server process. A save
// queues an agent-inbox item (career-ops's existing "ask the next session to
// do this" bridge) with the exact change precomputed, so it's a one-line
// confirmation next time, not a fresh conversation.
export function AutomationSettings() {
  const [time, setTime] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    fetch("/api/automation/schedule")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => setTime(typeof d.time === "string" ? d.time : ""))
      .catch(() => setLoadError(true));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!time) {
      setError("Pick a time first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/automation/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Could not save.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError("Could not save.");
    }
    setSaving(false);
  };

  return (
    <div>
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Daily scan time
      </label>
      <div className="rounded-xl border border-border bg-surface/50 p-4">
        <p className="text-xs leading-relaxed text-faint">
          When your daily job scan runs. Saved to <span className="font-mono text-muted">config/profile.yml</span> as
          your preference — but the actual trigger lives in a Claude scheduled task outside this app, so applying a
          change here queues it (via the agent inbox) for the next time an assistant session is open, rather than
          retiming it instantly. It&apos;ll take effect within a session or two — say so if it doesn&apos;t.
        </p>
        {loadError ? (
          <div className="mt-3 text-sm text-muted">
            <p className="text-red-500">Couldn&apos;t read your current scan-time preference.</p>
            <button
              type="button"
              onClick={load}
              className="mt-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover"
            >
              Retry
            </button>
          </div>
        ) : time === null ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <label className="mt-3 block">
              <span className="block text-sm font-medium text-foreground">Time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 w-32 rounded-md border border-border bg-surface/60 px-3 py-1.5 text-sm tabular-nums outline-none transition-colors focus:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/40"
              />
            </label>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={cn(
                "mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover",
                "disabled:pointer-events-none disabled:opacity-60",
              )}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : saved ? <Check className="size-3.5 text-emerald-400" /> : null}
              {saved ? "Saved · queued to apply" : "Save scan time"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
