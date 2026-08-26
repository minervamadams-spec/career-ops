import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.join("-") || "job"
  );
}

// Manual "paste a job in" intake — queues into data/pipeline.md, the SAME
// inbox the daily scan and `/career-ops pipeline` already read (AGENTS.md's
// Main Files table). Deliberately does NOT invoke the evaluate worker
// directly: inbox-triage.tsx's existing "Score" button already fires the
// real evaluate pipeline (kind:"evaluate") for any inbox row, URL or
// `local:` reference alike — reusing that proven trigger instead of adding a
// second evaluate-dispatch path here.
//
// Two intake shapes:
//   url given        → append `- [ ] {url} | company | role | ...` directly,
//                       same row shape modes/pipeline.md already documents.
//   jdText, no url    → write jds/{slug}-{date}.md (the JD text) and queue
//                       `- [ ] local:jds/{slug}-{date}.md | company | role`
//                       — the `local:` prefix modes/pipeline.md already
//                       documents for postings with no public URL.
// Richer fields the single pipeline.md line can't hold (platform,
// application questions, dependencies-before-applying, freeform notes) go
// into a sidecar `{same-slug}.intake.md` file, referenced from the note:
// label, so nothing typed into the form is silently dropped either way.
export async function POST(req: Request) {
  let body: {
    url?: string;
    jdText?: string;
    company?: string;
    role?: string;
    location?: string;
    workArrangement?: "" | "on-site" | "hybrid" | "remote";
    commuteMiles?: string;
    platform?: string;
    salaryMin?: string;
    salaryMax?: string;
    applicationQuestions?: string;
    dependencies?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const company = body.company?.trim();
  const role = body.role?.trim();
  const url = body.url?.trim();
  const jdText = body.jdText?.trim();
  if (!company || !role) return Response.json({ error: "company and role required" }, { status: 400 });
  if (!url && !jdText) return Response.json({ error: "either a URL or a pasted job description is required" }, { status: 400 });
  if (url && !/^https?:\/\//i.test(url)) return Response.json({ error: "url must start with http(s)://" }, { status: 400 });

  const root = careerOpsRoot();
  const today = new Date().toISOString().slice(0, 10);
  const slug = `${slugify(company)}-${slugify(role)}`;

  // "Remote" has no commute distance by definition; on-site/hybrid only carry
  // one when the user actually knows it yet (early postings often don't say).
  const arrangementLabel = { "on-site": "On-site", hybrid: "Hybrid", remote: "Remote", "": "" }[body.workArrangement || ""];
  const commuteSuffix = body.workArrangement !== "remote" && body.commuteMiles?.trim() ? `, ${body.commuteMiles.trim()}mi` : "";
  const arrangementLine = arrangementLabel ? `${arrangementLabel}${commuteSuffix}` : "";

  const hasIntakeExtras =
    body.platform || arrangementLine || body.salaryMin || body.salaryMax || body.applicationQuestions || body.dependencies || body.notes;
  let intakeNoteRef = "";
  if (hasIntakeExtras) {
    const intakeDir = path.join(root, "jds");
    fs.mkdirSync(intakeDir, { recursive: true });
    const intakeFile = `${slug}-${today}.intake.md`;
    const lines = [
      `# Intake notes — ${company} — ${role}`,
      `Added: ${today}`,
      body.platform ? `Platform: ${body.platform}` : "",
      arrangementLine ? `Work arrangement: ${arrangementLine}` : "",
      body.salaryMin || body.salaryMax ? `Salary: ${body.salaryMin || "?"}–${body.salaryMax || "?"}` : "",
      "",
      body.applicationQuestions ? `## Application questions\n\n${body.applicationQuestions}\n` : "",
      body.dependencies ? `## Dependencies before applying\n\n${body.dependencies}\n` : "",
      body.notes ? `## Notes\n\n${body.notes}\n` : "",
    ].filter(Boolean);
    fs.writeFileSync(path.join(intakeDir, intakeFile), lines.join("\n"), "utf8");
    intakeNoteRef = `jds/${intakeFile}`;
  }

  let jobUrl = url;
  if (!jobUrl && jdText) {
    const jdDir = path.join(root, "jds");
    fs.mkdirSync(jdDir, { recursive: true });
    const jdFile = `${slug}-${today}.md`;
    fs.writeFileSync(path.join(jdDir, jdFile), jdText, "utf8");
    jobUrl = `local:jds/${jdFile}`;
  }

  const compensation = body.salaryMin || body.salaryMax ? `$${body.salaryMin || "?"}–$${body.salaryMax || "?"}` : "";
  const locationBase = body.location?.trim() || "";
  const locationSeg = locationBase && arrangementLine ? `${locationBase} (${arrangementLine})` : locationBase || arrangementLine;
  const noteParts = [today];
  if (intakeNoteRef) noteParts.push(`intake: ${intakeNoteRef}`);
  const segments = [jobUrl, company, role, locationSeg, compensation].filter((s, i) => i < 3 || s !== "");
  const line = `- [ ] ${segments.join(" | ")} | posted: ${today} | note: ${noteParts.join(" — ")}`;

  const pipelineFile = path.join(root, "data", "pipeline.md");
  let md: string;
  try {
    md = fs.readFileSync(pipelineFile, "utf8");
  } catch {
    md = `# Pipeline — Pending URLs\n\nPaste job URLs below as \`- [ ] {url}\` then run \`/career-ops pipeline\`.\n\n## Pending\n\n`;
  }
  // New jobs belong at the top of Pending. Appending to EOF placed them under
  // an existing `## Processed` heading, and without a `posted:` date the inbox
  // freshness sort buried them behind hundreds of scanner rows.
  const pending = md.match(/^## Pending\s*$/m);
  if (pending?.index !== undefined) {
    const insertAt = pending.index + pending[0].length;
    md = `${md.slice(0, insertAt)}\n\n${line}${md.slice(insertAt)}`;
  } else {
    md = `${md.trimEnd()}\n\n## Pending\n\n${line}\n`;
  }
  atomicWrite(pipelineFile, md);

  return Response.json({ ok: true, url: jobUrl });
}
