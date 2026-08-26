"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { cn } from "@/lib/cn";

type CvVariant = { file: string; label: string };

function TailoredResumeGenerator({ n, company, pdfReady }: { n: string; company: string; pdfReady: boolean }) {
  const [variants, setVariants] = useState<CvVariant[] | null>(null);
  const [selected, setSelected] = useState<string>(""); // "" = cv.md (default)

  useEffect(() => {
    fetch("/api/cv-variants")
      .then((r) => r.json())
      .then((d) => setVariants(Array.isArray(d.variants) ? d.variants : []))
      .catch(() => setVariants([]));
  }, []);

  if (!variants) return <p className="text-xs text-faint">Loading…</p>;

  return (
    <div>
      <p className="mb-2 text-xs text-faint">
        Generates a keyword-optimized resume for this specific role. Base resume defaults to cv.md, or pick a curated variant below.
      </p>
      {variants.length > 0 && (
        <label className="mb-2 block">
          <span className="mb-1 block text-xs font-medium text-muted">Base resume to tailor</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50"
          >
            <option value="">cv.md (default)</option>
            {variants.map((v) => (
              <option key={v.file} value={v.file}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <GeneratePdfButton n={n} company={company} pdfReady={pdfReady} variant={selected || undefined} />
    </div>
  );
}

type FitCheckResult = {
  available: boolean;
  existing?: string[];
  supportedByResume?: string[];
  gap?: string[];
  error?: string;
};

type Version = { file: string; mtime: string };

function FitCheck() {
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FitCheckResult | null>(null);

  const run = async () => {
    if (!jdText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/fit-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText }),
      });
      setResult(await r.json());
    } catch {
      setResult({ available: false, error: "request failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs text-faint">
        Paste this job&apos;s description to check cv.md against it — zero-LLM, reads the JD&apos;s requirement list and classifies each
        against your CV (existing / mentioned elsewhere / gap). Works on the current cv.md, whether you&apos;re viewing or mid-edit.
      </p>
      <textarea
        value={jdText}
        onChange={(e) => setJdText(e.target.value)}
        placeholder="Paste the job description here…"
        rows={4}
        className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50"
      />
      <button
        onClick={run}
        disabled={loading || !jdText.trim()}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
      >
        {loading && <Loader2 className="size-3 animate-spin" />}
        Check fit
      </button>

      {result && (
        <div className="mt-3">
          {!result.available ? (
            <p className="text-xs text-red-500">{result.error ?? "Fit check unavailable"}</p>
          ) : (
            <div className="flex flex-col gap-2 text-xs">
              {!!result.existing?.length && (
                <div>
                  <span className="mr-1.5 text-faint">In your CV:</span>
                  {result.existing.map((s) => (
                    <Badge key={s} tone="good" className="mr-1 mb-1 normal-case">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              {!!result.supportedByResume?.length && (
                <div>
                  <span className="mr-1.5 text-faint">Mentioned elsewhere in your CV:</span>
                  {result.supportedByResume.map((s) => (
                    <Badge key={s} tone="info" className="mr-1 mb-1 normal-case">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              {!!result.gap?.length && (
                <div>
                  <span className="mr-1.5 text-faint">Gaps — not in your CV at all:</span>
                  {result.gap.map((s) => (
                    <Badge key={s} tone="warn" className="mr-1 mb-1 normal-case">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              {!result.existing?.length && !result.supportedByResume?.length && !result.gap?.length && (
                <p className="text-faint">No explicit requirement list found in that text.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VersionHistory({ company }: { company: string }) {
  const [versions, setVersions] = useState<Version[] | null>(null);

  useEffect(() => {
    fetch(`/api/cv-pdf?company=${encodeURIComponent(company)}&list=1`)
      .then((r) => (r.ok ? r.json() : { versions: [] }))
      .then((d) => setVersions(d.versions ?? []))
      .catch(() => setVersions([]));
  }, [company]);

  if (versions === null) return <p className="text-xs text-faint">Loading…</p>;
  if (versions.length === 0) return <p className="text-xs text-faint">No generated versions yet.</p>;

  return (
    <ul className="flex flex-col gap-1.5">
      {versions.map((v, i) => (
        <li key={v.file}>
          <a
            href={`/api/cv-pdf?company=${encodeURIComponent(company)}&file=${encodeURIComponent(v.file)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
          >
            <FileText className="size-3.5" />
            Version {versions.length - i} ·{" "}
            {new Date(v.mtime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </a>
        </li>
      ))}
    </ul>
  );
}

// "Resumes" panel — fit check, tailored generator (with a base-resume
// selector over cv-variants/, when curated variants exist), and version
// history for THIS job's tailored CV. Lives on the report page next to the
// header's GeneratePdfButton rather than as a separate global nav tab: the
// JD and tailoring context are per-job, so this is more useful attached to
// the job it's checking against than floating on its own page.
export function ResumesPanel({ n, company, pdfReady }: { n: string; company: string; pdfReady: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="group mt-3 overflow-hidden rounded-xl border border-border bg-surface/30" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-hover">
        <span className="text-sm font-medium">Resumes</span>
        <span className="hidden text-xs text-faint sm:inline">fit check · tailored generator · versions</span>
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </summary>
      <div className="flex flex-col gap-5 border-t border-border px-4 py-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">AI fit check</p>
          <FitCheck />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Tailored resume generator</p>
          <TailoredResumeGenerator n={n} company={company} pdfReady={pdfReady} />
        </div>
        {pdfReady && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Saved versions</p>
            <VersionHistory company={company} />
          </div>
        )}
      </div>
    </details>
  );
}
