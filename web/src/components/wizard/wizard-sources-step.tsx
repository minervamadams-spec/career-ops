"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import type { ProfileStepResult } from "./wizard-profile-step";
import { saveWizardCompanies } from "@/lib/wizard-company-save";

const inputCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50";

export type SourcesStepResult = { indeed: boolean; webSearch: boolean; companies: { name: string; careersUrl: string }[] };

export function WizardSourcesStep({ profile, onSaved }: { profile: ProfileStepResult; onSaved: (r: SourcesStepResult) => void }) {
  const [roles] = useState(profile.roles.join("\n"));
  const [location] = useState(profile.location);
  const [indeed, setIndeed] = useState(true);
  const [webSearch, setWebSearch] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [companies, setCompanies] = useState<{ name: string; careersUrl: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCompany = () => {
    if (!companyName.trim() || !companyUrl.trim()) return;
    if (!/^https?:\/\//i.test(companyUrl.trim())) return setError("Company careers URL must start with http(s)://");
    setError(null);
    setCompanies((c) => [...c, { name: companyName.trim(), careersUrl: companyUrl.trim() }]);
    setCompanyName("");
    setCompanyUrl("");
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const rolesArr = roles.split(/[,\n]/).map((r) => r.trim()).filter(Boolean);
      const r = await fetch("/api/portals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: rolesArr, location: location ? [location] : [] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed to save sources");

      const companyResult = await saveWizardCompanies(companies);
      if (companyResult.failed.length) {
        const names = companyResult.failed.map((item) => item.name).join(", ");
        setError(`Couldn’t save ${names}. Check the careers URL and try again. Nothing was silently skipped.`);
        return;
      }

      onSaved({ indeed, webSearch, companies: companyResult.saved });
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to save sources");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="font-display text-xl text-landing">Where should we look?</h2>
      <p className="mt-1.5 text-sm text-muted">
        Pick sources to aggregate from. Your target roles ({profile.roles.join(", ")}) drive the filter on all of them.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <ToggleRow
          checked={indeed}
          onChange={setIndeed}
          title="Mention Indeed in setup instructions"
          hint="Pipeline always includes a pre-filled Indeed link. This reminder keeps it manual: you review results before adding anything."
        />
        <ToggleRow
          checked={webSearch}
          onChange={setWebSearch}
          title="Google / web search"
          hint="Human-review link-out for boards and company sites that Offerly does not scan automatically."
        />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Specific companies (optional)</p>
        <p className="mb-2 text-xs text-faint">
          Track individual companies&apos; career pages directly — works best for Greenhouse/Ashby/Lever/Workday-hosted
          boards, auto-detected from the URL.
        </p>
        <div className="flex gap-2">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="Company name" />
          <input value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} className={inputCls} placeholder="https://company.com/careers" />
          <button onClick={addCompany} className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-brand/40 hover:text-brand">
            <Plus className="size-4" />
          </button>
        </div>
        {companies.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {companies.map((c, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-1.5 text-sm">
                <Check className="size-3.5 text-emerald-500" />
                <span className="font-medium">{c.name}</span>
                <span className="truncate text-xs text-faint">{c.careersUrl}</span>
                <button onClick={() => setCompanies((cs) => cs.filter((_, j) => j !== i))} className="ml-auto text-faint hover:text-red-500">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
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

function ToggleRow({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface/50 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-faint">{hint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-surface-hover"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
