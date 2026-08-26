"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { CANONICAL_STATES } from "@/lib/format";
import { PassReasonPrompt } from "@/components/pass-reason";

const PASS_STATES = new Set(["Discarded", "SKIP"]);

// Status writeback control. Updates the existing tracker row (status cell) via
// /api/status — never adds rows. Reverts on failure; confirms with the
// terminal-popup animation. Discarded/SKIP go through the same "why are you
// passing?" capture the Today dashboard's decision cards already use — the
// reason lands in the tracker's Notes cell AND, for a location reason,
// generalizes into a standing exclusion (see /api/status's lead-feedback
// write) so a company you've passed on for being too far doesn't keep
// resurfacing.
export function StatusSelect({ n, current, company }: { n: string; current: string; company: string }) {
  const [status, setStatus] = useState(current);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();

  async function commit(next: string, note?: string) {
    const prev = status;
    setStatus(next);
    setBusy(true);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, status: next, ...(note ? { note: `Passed: ${note}` } : {}) }),
      });
      if (!res.ok) throw new Error("write failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch {
      setStatus(prev); // revert on failure
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (PASS_STATES.has(next)) {
      setPending(next);
      return;
    }
    void commit(next);
  }

  if (pending) {
    return (
      <PassReasonPrompt
        company={company}
        busy={busy}
        confirmLabel={(hasReason) => (hasReason ? `Set ${pending} with reason` : `Set ${pending} without a reason`)}
        onConfirm={(reason) => commit(pending, reason)}
        onCancel={() => setPending(null)}
      />
    );
  }

  const known = (CANONICAL_STATES as readonly string[]).includes(status);
  return (
    <span className="inline-flex items-center gap-2">
      <label className="text-xs text-faint">status</label>
      <select
        value={status}
        onChange={onChange}
        disabled={busy}
        className="rounded-md border border-border bg-surface px-2.5 py-1 text-sm text-foreground outline-none transition-colors focus:border-brand/50 disabled:opacity-50 max-sm:min-h-[44px]"
      >
        {!known && <option value={status}>{status}</option>}
        {CANONICAL_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {saved && (
        <span className="animate-terminal-popup inline-flex items-center gap-1 text-xs font-medium text-brand">
          <Check className="size-3" /> saved
        </span>
      )}
    </span>
  );
}
