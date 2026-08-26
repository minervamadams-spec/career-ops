"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

// Common, low-friction reasons — a tap beats typing for the 80% case; the free
// text field still catches anything sharper. Shared between every surface that
// lets the user pass on a lead (scored decision cards, raw discovery cards) so
// the reasons stay consistent and worth aggregating later.
export const PASS_REASONS = ["Comp too low", "Wrong seniority", "Location/remote", "Not my domain", "Culture/red flag", "Already applied elsewhere"];

export type LeadFeedback = {
  url: string;
  company: string;
  role: string;
  reason?: string;
  source: "today" | "explore" | "pipeline";
  inPipeline: boolean;
};

/** Inline "why are you passing?" capture — chips + free text, confirm/cancel.
 *  Reason is optional: `onConfirm(undefined)` fires from the no-reason path. */
export function PassReasonPrompt({
  company,
  busy,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  company: string;
  busy?: boolean;
  confirmLabel?: (hasReason: boolean) => string;
  onConfirm: (reason: string | undefined) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const label = confirmLabel ?? ((hasReason: boolean) => (hasReason ? "Skip with reason" : "Skip without a reason"));

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-surface/40 p-3.5">
      <p className="truncate text-xs text-muted">
        Why pass on <span className="font-medium text-foreground">{company}</span>? Optional — helps future scoring.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PASS_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors max-sm:min-h-[32px]",
              reason === r ? "border-brand/40 bg-brand-soft text-brand-text" : "border-border text-muted hover:border-brand/30 hover:text-foreground",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!busy) onConfirm(reason.trim() || undefined);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Or type your own reason…"
        maxLength={300}
        autoFocus
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-faint focus:border-brand/40 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => onConfirm(reason.trim() || undefined)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand-text transition hover:bg-brand/15 disabled:opacity-60 max-sm:min-h-[44px]"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {label(!!reason.trim())}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-60 max-sm:min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Fire-and-forget durable-fact write — the shared "learn from it" hook every
 *  pass-with-reason action uses so future evaluations account for it (see
 *  api/run's buildPrompt "Durable notes about the user"). */
export function rememberPassReason(company: string, role: string, reason: string) {
  fetch("/api/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fact: `Passed on ${company} (${role}): ${reason}` }),
  }).catch(() => {});
}

/** Persist a machine-readable lead decision locally. The server also closes a
 * matching pipeline row, so dismissing from Today/Explore is a complete action. */
export function recordLeadDismissal(feedback: LeadFeedback) {
  return fetch("/api/lead-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...feedback, decision: "dismissed" }),
  });
}
