"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

// "Paste a job in" — the manual counterpart to the daily scan: for a posting
// the scan didn't catch (a referral, something behind a login, a screenshot
// from an email). Queues into the SAME inbox (data/pipeline.md) the scan
// writes to, via /api/inbox/add — see that route for why it doesn't dispatch
// evaluation directly.
export function AddJobForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [platform, setPlatform] = useState("");
  const [url, setUrl] = useState("");
  const [jdText, setJdText] = useState("");
  const [location, setLocation] = useState("");
  const [workArrangement, setWorkArrangement] = useState<"" | "on-site" | "hybrid" | "remote">("");
  const [commuteMiles, setCommuteMiles] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [applicationQuestions, setApplicationQuestions] = useState("");
  const [dependencies, setDependencies] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (!company.trim() || !role.trim()) return setError("Company and role are required.");
    if (!url.trim() && !jdText.trim()) return setError("Add either a job URL or paste the job description.");
    setBusy(true);
    try {
      const r = await fetch("/api/inbox/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          role,
          platform,
          url,
          jdText,
          location,
          workArrangement,
          commuteMiles: workArrangement === "remote" ? "" : commuteMiles,
          salaryMin,
          salaryMax,
          applicationQuestions,
          dependencies,
          notes,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed to add");
      setDone(true);
      setTimeout(() => router.push("/pipeline"), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to add");
    } finally {
      setBusy(false);
    }
  };

  if (done) return <p className="text-sm text-emerald-600 dark:text-emerald-400">Added to your inbox — redirecting…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Company *">
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} placeholder="Acme Boutique" />
        </Field>
        <Field label="Role *">
          <input value={role} onChange={(e) => setRole(e.target.value)} className={inputCls} placeholder="Product Manager" />
        </Field>
        <Field label="Platform">
          <input value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls} placeholder="LinkedIn, Indeed, referral…" />
        </Field>
        <Field label="Location">
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="Remote, or City, State" />
        </Field>
        <Field label="Work arrangement">
          <select value={workArrangement} onChange={(e) => setWorkArrangement(e.target.value as typeof workArrangement)} className={inputCls}>
            <option value="">Not specified</option>
            <option value="on-site">On-site</option>
            <option value="hybrid">Hybrid</option>
            <option value="remote">Remote</option>
          </select>
        </Field>
        {(workArrangement === "on-site" || workArrangement === "hybrid") && (
          <Field label="Commute distance (miles)">
            <input
              value={commuteMiles}
              onChange={(e) => setCommuteMiles(e.target.value)}
              className={inputCls}
              placeholder="e.g. 12"
              inputMode="numeric"
            />
          </Field>
        )}
        <Field label="Salary min ($)">
          <input value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className={inputCls} placeholder="90000" inputMode="numeric" />
        </Field>
        <Field label="Salary max ($)">
          <input value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} className={inputCls} placeholder="130000" inputMode="numeric" />
        </Field>
      </div>

      <Field label="Job URL (leave blank if you're pasting the description instead)">
        <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://…" />
      </Field>

      <Field label="Job description (paste here if there's no URL, or the URL is behind a login)">
        <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={5} className={inputCls} placeholder="Paste the full posting text…" />
      </Field>

      <Field label="Application questions (paste from the form, if you have them)">
        <textarea value={applicationQuestions} onChange={(e) => setApplicationQuestions(e.target.value)} rows={3} className={inputCls} />
      </Field>

      <Field label="Dependencies before applying">
        <textarea
          value={dependencies}
          onChange={(e) => setDependencies(e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="e.g. need a reference from X, waiting on a portfolio update…"
        />
      </Field>

      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
      </Field>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        Add to inbox
      </button>
      <p className="text-xs text-faint">
        This queues the job in your inbox (same place the daily scan adds to) — open it from the Pipeline&apos;s Inbox tab to run a fit
        evaluation on it.
      </p>
    </div>
  );
}
