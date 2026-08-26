import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Application } from "@/lib/career-ops";
import { Badge } from "@/components/ui/badge";
import { scoreTone, scoreNum, legitimacyTone, parseReport } from "@/lib/format";
import { StatusSelect } from "@/components/status-select";
import { CompanyLogo } from "@/components/company-logo";
import { ScoreMethodology } from "@/components/score-methodology";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { ResumesPanel } from "@/components/resumes-panel";
import { ApplyButton } from "@/components/apply-button";
import { DeleteFromTracker } from "@/components/delete-from-tracker";
import { ReportRecovery } from "@/components/report-recovery";
import { ApplicationQuestions } from "@/components/application-questions";
import { GapConfirmation } from "@/components/gap-confirmation";
import { ContactsPanel } from "@/components/contacts-panel";

// The report is an audit trail, not the primary interface. Lead with a short
// decision brief and keep the full analysis behind one explicit disclosure.

type Section = { heading: string; letter: string | null; content: string };

function cleanHeading(h: string): string {
  const stripped = h
    .replace(/^\s*(?:Block\s+)?[A-G][).:]\s*/i, "")
    .replace(/\s*\((?:lead|verdict)\)\s*$/i, "")
    .trim();
  return stripped || h.trim();
}

// Machine artifacts (collapsed because they're for devs, not the mainstream) vs
// human content C–G (collapsed only for length) — ux's "honest for devs" tier.
function isMachine(heading: string): boolean {
  return /machine summary|submitted|submit[-\s]?log/i.test(heading);
}

// A one-line teaser for a collapsed content section — drops the interaction cost
// of "what's in here?" without defeating the collapse.
function preview(md: string): string {
  const text = md
    .replace(/^#+\s.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > 96 ? sentence.slice(0, 96).trimEnd() + "…" : sentence;
}

function tableRows(md: string): string[][] {
  return md
    .split("\n")
    .filter((line) => /^\s*\|.*\|\s*$/.test(line) && !/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(line))
    .map((line) => line.slice(line.indexOf("|") + 1, line.lastIndexOf("|")).split("|").map((cell) => cell.trim()))
    .filter((row) => !/^(field|jd requirement|source|signal)$/i.test(row[0] ?? ""));
}

function decisionBrief(sections: Section[]) {
  const role = sections.find((s) => s.letter === "A");
  const match = sections.find((s) => s.letter === "B");
  const roleRows = role ? tableRows(role.content) : [];
  const summary = roleRows.find((row) => /^tl;?dr$/i.test(row[0] ?? ""))?.[1] ?? (role ? preview(role.content) : "");
  const strengths = match ? tableRows(match.content).slice(0, 3).map((row) => row[0]).filter(Boolean) : [];
  const gapsText = match?.content.split(/\*\*Gaps:\*\*/i)[1] ?? "";
  const gaps = [...gapsText.matchAll(/^\s*\d+\.\s+\*\*(.+?)\*\*/gm)].slice(0, 3).map((m) => m[1]);
  return { summary, strengths, gaps };
}

function splitSections(body: string): { intro: string; sections: Section[] } {
  const intro: string[] = [];
  const sections: Section[] = [];
  let cur: { heading: string; letter: string | null; lines: string[] } | null = null;
  for (const line of body.split("\n")) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      if (cur) sections.push({ heading: cur.heading, letter: cur.letter, content: cur.lines.join("\n").trim() });
      const heading = h[1].trim();
      const letter = heading.match(/^(?:Block\s+)?([A-G])[).:\s]/i)?.[1]?.toUpperCase() ?? null;
      cur = { heading, letter, lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  if (cur) sections.push({ heading: cur.heading, letter: cur.letter, content: cur.lines.join("\n").trim() });
  return { intro: intro.join("\n").trim(), sections };
}

export function ReportView({
  id,
  app,
  report,
  recoveryUrl,
  canDelete = false,
}: {
  id: string;
  app: Application | null;
  report: string | null;
  recoveryUrl?: string | null;
  /** kept in the props contract (the page passes it) but no longer surfaced —
   *  the raw .md filename is a dev artifact, not header content. */
  file?: string | null;
  canDelete?: boolean;
}) {
  const meta = report ? parseReport(report) : null;
  const field = (label: string) => meta?.fields.find((f) => f.label === label)?.value;
  const score = app?.score || field("Score");
  const date = app?.date || field("Date");
  const archetype = field("Archetype");
  const url = field("URL");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft className="size-4" /> Pipeline
      </Link>

      <header className="mt-5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">#{id}</p>
        <div className="mt-2 flex items-center gap-3">
          <CompanyLogo name={app?.company ?? meta?.title ?? `Report #${id}`} size={40} />
          <h1 className="font-display text-3xl tracking-tight text-landing">
            {app?.company ?? meta?.title ?? `Report #${id}`}
          </h1>
        </div>
        {app?.role && <p className="mt-1 text-muted">{app.role}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {score && <Badge tone={scoreTone(score)}>{score}</Badge>}
          {/* Verdict-first: the score's apply/don't-apply call (4.0 is the line,
              per the public methodology) as a <2s-scannable chip. */}
          {(() => {
            const n = scoreNum(score ?? "");
            if (Number.isNaN(n)) return null;
            return n >= 4.0 ? <Badge tone="good">Recommended</Badge> : <Badge tone="muted">Below the apply line</Badge>;
          })()}
          {meta?.legitimacy && <Badge tone={legitimacyTone(meta.legitimacy)}>{meta.legitimacy}</Badge>}
          {app && <StatusSelect n={id} current={app.status} />}
          {report && <GeneratePdfButton n={id} company={app?.company ?? meta?.title ?? id} pdfReady={(app?.pdf ?? "").includes("✅")} />}
          {report && <ApplyButton n={id} url={url && url.startsWith("http") ? url : undefined} company={app?.company ?? meta?.title ?? id} pdfReady={(app?.pdf ?? "").includes("✅")} />}
        </div>

        {report && <ResumesPanel n={id} company={app?.company ?? meta?.title ?? id} pdfReady={(app?.pdf ?? "").includes("✅")} />}
        {app && <ContactsPanel company={app.company} tracker={id} />}

        {app && canDelete && (
          <div className="mt-3">
            <DeleteFromTracker n={id} />
          </div>
        )}

        {(archetype || date || (url && url.startsWith("http"))) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            {archetype && <span className="max-w-full truncate">{archetype}</span>}
            {date && <span className="tabular-nums text-faint">{date}</span>}
            {url && url.startsWith("http") && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 text-brand hover:underline max-sm:min-h-[44px]"
              >
                posting <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        )}
      </header>

      {report ? (
        <>
          {(() => {
            const { intro, sections } = splitSections(meta?.body ?? report);
            // Tolerant fallback: unrecognized layout → render the whole body as
            // before, so an old/odd report never loses content.
            if (sections.length === 0) {
              return (
                <article className="report-prose mt-8">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{meta?.body ?? report}</ReactMarkdown>
                </article>
              );
            }
            const brief = decisionBrief(sections);
            const machine = sections.filter((s) => isMachine(s.heading));
            const mainSections = sections.filter((s) => !isMachine(s.heading));
            return (
              <div className="mt-8">
                {intro && (
                  <article className="report-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
                  </article>
                )}

                <div className="rounded-2xl border border-brand/25 bg-brand-soft/40 p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand/80">Decision brief</p>
                  {brief.summary && <p className="mt-2 text-sm leading-6 text-foreground">{brief.summary}</p>}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {brief.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Strong matches</p>
                        <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                          {brief.strengths.map((item) => <li key={item} className="flex gap-2"><span className="text-good">✓</span><span>{item}</span></li>)}
                        </ul>
                      </div>
                    )}
                    {brief.gaps.length > 0 && <GapConfirmation gaps={brief.gaps} />}
                  </div>
                </div>

                <ApplicationQuestions id={id} />

                <details className="group mt-4 overflow-hidden rounded-xl border border-border bg-surface/30">
                  <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-hover">
                    <span className="text-sm font-medium">Full analysis</span>
                    <span className="text-xs text-faint">Evidence, interview prep, compensation and risks</span>
                    <ChevronDown className="ml-auto size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-border px-4 pb-4">
                    {mainSections.map((s, i) => (
                      <details key={i} className="group/section mt-3 overflow-hidden rounded-lg border border-border/70">
                        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 py-2.5 hover:bg-surface-hover">
                          <span className="text-sm font-medium">{cleanHeading(s.heading)}</span>
                          <span className="hidden truncate text-xs text-faint sm:inline">{preview(s.content)}</span>
                          <ChevronDown className="ml-auto size-4 shrink-0 text-faint transition-transform group-open/section:rotate-180" />
                        </summary>
                        <div className="report-prose overflow-x-auto border-t border-border/70 px-4 py-3">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                        </div>
                      </details>
                    ))}
                    {machine.map((s, i) => (
                      <details key={i} className="group/section mt-3 overflow-hidden rounded-lg border border-border/60 opacity-80">
                        <summary className="flex min-h-[44px] cursor-pointer list-none items-center px-3 py-2.5 font-mono text-xs text-muted">
                          Technical: {cleanHeading(s.heading)}
                          <ChevronDown className="ml-auto size-4 transition-transform group-open/section:rotate-180" />
                        </summary>
                        <div className="report-prose overflow-x-auto border-t border-border/60 px-4 py-3">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              </div>
            );
          })()}
          <ScoreMethodology />
        </>
      ) : (
        app ? (
          <ReportRecovery company={app.company} role={app.role} url={recoveryUrl ?? null} />
        ) : (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/30 p-5 text-sm text-muted">
            <FileText className="size-5 shrink-0 text-faint" /> No detailed report was found for #{id}.
          </div>
        )
      )}
    </div>
  );
}
