"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

// Structured self-filter taxonomy — mirrors templates/skip-reasons.yml (the
// server-side source of truth, read live by web/src/lib/core/skip-reasons.ts
// and set-status.mjs). Kept as a client-safe constant here the same way
// web/src/lib/format.ts's CANONICAL_STATES mirrors templates/states.yml —
// update both together if the taxonomy changes.
export const SKIP_REASONS: { id: string; label: string }[] = [
  { id: "not_my_domain", label: "Not my domain" },
  { id: "location_or_remote_restricted", label: "Location/remote" },
  { id: "outside_commute_radius", label: "Outside commute radius" },
  { id: "expired_listing", label: "Expired listing" },
  { id: "unwanted_part_time_or_fractional", label: "Unwanted part-time/fractional" },
  { id: "duplicate_of_existing", label: "Already applied elsewhere" },
  { id: "not_qualified", label: "Not qualified" },
  { id: "travel_required", label: "Travel required" },
  { id: "comp_too_low", label: "Comp too low" },
  { id: "wrong_seniority", label: "Wrong seniority" },
  { id: "undesired_shift_or_schedule", label: "Undesired shift/schedule" },
  { id: "skill_or_background_mismatch", label: "Skill/background mismatch" },
];

export type PassReasonSelection = { reasonId: string | null; text: string };

export type LeadFeedback = {
  url: string;
  company: string;
  role: string;
  reason?: string;
  source: "today" | "explore" | "pipeline";
  inPipeline: boolean;
};

/** Inline "why are you passing?" capture — taxonomy chips + free text,
 *  confirm/cancel. Set `reasonRequired` to block confirm until a chip is
 *  picked (the SKIP tracker-status flow); omit it for the lighter-weight
 *  raw-lead dismissal flow, where a reason stays optional. */
export function PassReasonPrompt({
  company,
  busy,
  reasonRequired,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  company: string;
  busy?: boolean;
  reasonRequired?: boolean;
  confirmLabel?: (hasReason: boolean) => string;
  onConfirm: (selection: PassReasonSelection) => void;
  onCancel: () => void;
}) {
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const hasReason = reasonId != null || text.trim().length > 0;
  const canConfirm = reasonRequired ? reasonId != null : true;
  const label = confirmLabel ?? ((hasReason_: boolean) => (hasReason_ ? "Skip with reason" : "Skip without a reason"));

  function confirm() {
    if (busy || !canConfirm) return;
    onConfirm({ reasonId, text: text.trim() });
  }

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-surface/40 p-3.5">
      <p className="truncate text-xs text-muted">
        Why pass on <span className="font-medium text-foreground">{company}</span>?
        {reasonRequired ? " Pick one." : " Optional — helps future scoring."}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SKIP_REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReasonId(r.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors max-sm:min-h-[32px]",
              reasonId === r.id ? "border-brand/40 bg-brand-soft text-brand-text" : "border-border text-muted hover:border-brand/30 hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirm();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={reasonRequired ? "Add detail (optional)…" : "Or type your own reason…"}
        maxLength={300}
        autoFocus
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-faint focus:border-brand/40 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!!busy || !canConfirm}
          onClick={confirm}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand-text transition hover:bg-brand/15 disabled:opacity-60 max-sm:min-h-[44px]"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {label(hasReason)}
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

/** Compose a display string from a selection — reason label plus optional
 *  free text — for surfaces that only want one string (rememberPassReason,
 *  recordLeadDismissal). Returns "" when nothing was picked or typed. */
export function selectionToText(selection: PassReasonSelection): string {
  const label = selection.reasonId ? (SKIP_REASONS.find((r) => r.id === selection.reasonId)?.label ?? "") : "";
  if (label && selection.text) return `${label} — ${selection.text}`;
  return label || selection.text;
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
