"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50";

export type ProfileStepResult = { roles: string[]; location: string };

export function WizardProfileStep({ onSaved }: { onSaved: (r: ProfileStepResult) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [roles, setRoles] = useState("");
  const [compMin, setCompMin] = useState("");
  const [compMax, setCompMax] = useState("");
  const [remote, setRemote] = useState("");
  const [weeklyJobsTarget, setWeeklyJobsTarget] = useState("10");
  const [applyingDaysTarget, setApplyingDaysTarget] = useState("2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleList = () =>
    roles
      .split(/[,\n]/)
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(0, 6);

  const submit = async () => {
    setError(null);
    const rolesArr = roleList();
    if (!name.trim() || !email.trim()) return setError("Name and email are required.");
    if (rolesArr.length === 0) return setError("Add at least one target role.");
    setBusy(true);
    try {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          location,
          roles: rolesArr,
          compMin: compMin ? Number(compMin) : undefined,
          compMax: compMax ? Number(compMax) : undefined,
          currency: "USD",
          remote,
          weeklyJobsTarget: Number(weeklyJobsTarget) || undefined,
          applyingDaysTarget: Number(applyingDaysTarget) || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed to save");
      onSaved({ roles: rolesArr, location });
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="font-display text-xl text-landing">You, and what you&apos;re after</h2>
      <p className="mt-1.5 text-sm text-muted">This writes your config/profile.yml — you can refine it any time by asking the assistant.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Jane Smith" />
        </Field>
        <Field label="Email *">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="jane@example.com" type="email" />
        </Field>
        <Field label="Location">
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="Austin, TX" />
        </Field>
        <Field label="Remote preference">
          <select value={remote} onChange={(e) => setRemote(e.target.value)} className={inputCls}>
            <option value="">Not specified</option>
            <option value="Remote only">Remote only</option>
            <option value="Remote OK, local preferred">Remote OK, local preferred</option>
            <option value="On-site/hybrid only">On-site/hybrid only</option>
          </select>
        </Field>
        <Field label="Salary min ($)">
          <input value={compMin} onChange={(e) => setCompMin(e.target.value)} className={inputCls} placeholder="90000" inputMode="numeric" />
        </Field>
        <Field label="Salary max ($)">
          <input value={compMax} onChange={(e) => setCompMax(e.target.value)} className={inputCls} placeholder="130000" inputMode="numeric" />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Target roles * (one per line, up to 6 — these drive both your search filter and the daily scan)">
          <textarea value={roles} onChange={(e) => setRoles(e.target.value)} rows={3} className={inputCls} placeholder={"Product Manager\nOperations Manager"} />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Weekly goal: jobs added">
          <input value={weeklyJobsTarget} onChange={(e) => setWeeklyJobsTarget(e.target.value)} className={inputCls} inputMode="numeric" />
        </Field>
        <Field label="Weekly goal: days spent applying">
          <input value={applyingDaysTarget} onChange={(e) => setApplyingDaysTarget(e.target.value)} className={inputCls} inputMode="numeric" />
        </Field>
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        Continue
      </button>
    </div>
  );
}
