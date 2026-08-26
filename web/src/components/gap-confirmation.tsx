"use client";

import { useState } from "react";
import { Check, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GapConfirmation({ gaps }: { gaps: string[] }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [details, setDetails] = useState("");
  const [confirmed, setConfirmed] = useState<number[]>([]);
  const [error, setError] = useState("");
  if (!gaps.length) return null;
  const save = async (index: number) => {
    setError("");
    const response = await fetch("/api/gap-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gap: gaps[index], details }) });
    if (!response.ok) { setError("Couldn’t save that correction."); return; }
    setConfirmed((current) => [...current, index]);
    setEditing(null);
    setDetails("");
  };
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Please confirm</p>
      <p className="mt-1 text-xs text-faint">These are possible gaps. Tell me when the report missed experience you have.</p>
      <ul className="mt-2 space-y-2 text-sm text-foreground">
        {gaps.map((gap, index) => (
          <li key={gap} className="rounded-lg border border-border/70 bg-surface/50 p-2.5">
            <div className="flex items-start gap-2">
              <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-brand" />
              <span className="flex-1">{gap}</span>
              {confirmed.includes(index) ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="size-3.5" /> Added</span> : <button onClick={() => setEditing(index)} className="shrink-0 text-xs font-medium text-brand hover:underline">I have this</button>}
            </div>
            {editing === index && (
              <div className="mt-2 pl-6">
                <label className="text-xs text-muted">Where did you use it, and what did you do?</label>
                <textarea autoFocus value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50" />
                <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => save(index)} disabled={!details.trim()}>Save to my profile</Button><Button size="sm" variant="ghost" onClick={() => { setEditing(null); setDetails(""); }}>Cancel</Button></div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
