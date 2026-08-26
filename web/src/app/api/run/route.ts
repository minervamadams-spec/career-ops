import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveCli } from "@/lib/clis";
import { careerOpsRoot, readMemory, findReportFile } from "@/lib/career-ops";
import { resolvePdfPaths, type PdfPaths } from "@/lib/pdf-paths.mjs";
import { renderAndMarkPdf } from "@/lib/pdf-render.mjs";
import { acquireTrackerWrite, releaseTrackerWrite } from "@/lib/core/run-registry";
import { classifyRunFailure, isAuthenticationDiagnostic } from "@/lib/run-failure.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // a real oferta evaluation / pdf-mode CV tailoring + render is heavy and multi-step

const activeEvaluationUrls: Set<string> =
  (globalThis as typeof globalThis & { __careerOpsActiveEvaluations?: Set<string> }).__careerOpsActiveEvaluations ??= new Set<string>();

// The web ORCHESTRATES the real career-ops engine — it does NOT reimplement it.
// kind "evaluate" runs the REAL modes/oferta.md and persists the canonical
// artifacts (A–F report + tracker row) via the SAME scripts the CLI uses
// (reserve-report-num.mjs → reports/ → batch/tracker-additions/ → merge-tracker.mjs),
// so a web evaluation is byte-identical to a CLI one (single source of truth, no
// drift). kind "research" stays read-only. Streams progress as NDJSON events.
type BuildPromptArgs = {
  kind: string;
  input: string;
  memory: string;
  today: string;
  pdfPaths?: PdfPaths;
  reportFile?: string;
  variant?: string;
  outreachPath?: string;
  contactName?: string;
  contactTitle?: string;
};

function buildPrompt({ kind, input, memory, today, pdfPaths, reportFile, variant, outreachPath, contactName, contactTitle }: BuildPromptArgs): string {
  const mem = memory.trim() ? `\n\nDurable notes about the user (from their profile):\n${memory.trim()}\n` : "";
  if (kind === "research") {
    return `You are investigating the user's OWN work / portfolio to surface job-search-relevant strengths, headless. Investigate the target (use WebFetch for URLs; read local files if referenced) and report: what it is, why it is impressive, and how to leverage it in their job search — which roles/claims it supports and how to frame it on a CV. Be specific, honest, and encouraging.${mem}

End with EXACTLY one final line: VERDICT: {0-5 signal strength}/5 — {why it helps their search, ≤12 words}

Target: ${input}`;
  }
  if (kind === "pdf") {
    // The agent tailors content only — it never renders the PDF itself. Rendering
    // launches a real browser, which an agent CLI's own sandbox may block with no
    // human present to approve an escalation (headless/web-triggered run, #2172).
    // The backend (a plain Node process, no CLI sandbox) renders after this closes.
    const baseCvLine = variant
      ? `Read modes/pdf.md, cv-variants/${variant} (use THIS as the base CV content instead of cv.md — it's a cv.md-derived variant curated for this posting type), config/profile.yml, and the evaluation report at ${reportFile} (for the JD keywords + analysis).`
      : `Read modes/pdf.md, cv.md, config/profile.yml, and the evaluation report at ${reportFile} (for the JD keywords + analysis).`;
    return `You are tailoring the user's ATS-optimized CV for application #${input}, headless, on their machine. Run the REAL career-ops "pdf" mode's CONTENT step — follow modes/pdf.md EXACTLY for tailoring (do not improvise a format).
1. ${baseCvLine}
2. Tailor the CV per modes/pdf.md: inject the JD's keywords into the summary + first bullets, reorder experience by relevance, build the competency grid, pick the top 3–4 projects. NEVER invent skills — only reword REAL experience using the JD's vocabulary or content already present in the base CV read in step 1.
3. Fill templates/cv-template.html's {{...}} placeholders with the tailored content; write the HTML to EXACTLY this path: ${pdfPaths?.html}
4. Decide the page format for this company (letter for US/Canada, else a4) and write EXACTLY this JSON (nothing else) to EXACTLY this path: ${pdfPaths?.meta}
   {"format": "letter"} or {"format": "a4"}
Do NOT run generate-pdf.mjs yourself and do NOT render a PDF — the platform renders it after you finish, from the HTML and format file you wrote. Do NOT touch data/applications.md — the platform updates the tracker's PDF column itself, only after a confirmed successful render. Do not submit anything anywhere.

End with EXACTLY one final line: VERDICT: {5 if the HTML and format file were written, else 1}/5 — {a one-line summary, ≤12 words}`;
  }
  if (kind === "outreach") {
    // The contact is already confirmed (name + title came from the report's
    // saved contact, not a fresh lookup), so this skips modes/contacto.md's
    // WebSearch discovery step entirely and goes straight to drafting — no
    // WebFetch/WebSearch granted below, deliberately.
    return `You are drafting ONE outreach message for application #${input}, headless, on the user's machine. Follow modes/contacto.md's "LinkedIn power move" persona engine EXACTLY — but skip step 1 (contact discovery), the contact is already confirmed:
  Name: ${contactName || "(name not given)"}
  Title: ${contactTitle || "(title not given)"}

1. Read modes/contacto.md, cv.md, config/profile.yml, and the evaluation report at ${reportFile} (for the role's specifics and why it's a fit).
2. Classify the contact type from their title (Recruiter / Hiring Manager / Peer / Interviewer) — default to Hiring Manager if the title doesn't clearly say otherwise.
3. Write the 3-sentence message for that persona, ≤300 characters total, in modes/contacto.md's voice (no corporate-speak, no "I'm passionate about", never share a phone number). Reformulate REAL experience from cv.md only — never invent a skill, metric, or claim.
4. Write ONLY the message itself (no preamble, no quotes around it, no character count) to EXACTLY this path: ${outreachPath}
Do NOT save this contact anywhere, do NOT touch data/contacts.tsv, do NOT open or post to LinkedIn, do NOT send or submit anything — this is a draft the user reviews and sends themselves.${memory}

End with EXACTLY one final line: VERDICT: {5 if the draft was written, else 1}/5 — {a one-line summary, ≤12 words}`;
  }
  if (kind === "fix-bug") {
    // Replaces the old "file a GitHub issue on the upstream repo" flow
    // (2026-08-14) — that made sense for career-ops itself, not for a
    // renamed fork handed to other people. `input` is the diagnostic block
    // built client-side by lib/report/report.ts's fixBugContext() (same
    // scrubbed, non-personal data the old GitHub issue carried: route,
    // recent client errors, data-shape counts — never cv.md/profile/answers).
    return `A user hit a bug in this web app and reported it from inside the app, headless, on their own machine. Find the real cause and fix it in the source — don't just work around the symptom.

${input}

Your job:
1. From the screen (route above) and the recent client errors, find the relevant source under web/src/ — or the core .mjs scripts if the error/data-shape points at core logic, not the web layer.
2. Reproduce or clearly explain the root cause before changing anything.
3. Fix it directly in the source.
4. Verify: run \`npx tsc --noEmit\` inside web/ and confirm no new type errors. If the fix touched a core .mjs script with its own tests, run those too.
5. Do NOT touch any user data files (cv.md, config/profile.yml, data/*, portals.yml, cv-variants/*, reports/*, output/*, jds/*) — this is a code-only fix.
6. Summarize what was wrong and exactly what you changed (file:line).

End with EXACTLY one final line: VERDICT: {5 if fixed and verified, 3 if fixed but unverified, 1 if you couldn't reproduce or fix it}/5 — {one-line summary of the fix, ≤12 words}`;
  }
  if (kind === "fix-portal") {
    return `A company's job-portal ATS slug is BROKEN — career-ops can no longer scan it, so it silently disappears from every future scan. Repair it (headless, on the user's machine):
1. Run \`node verify-portals.mjs --add "${input}"\` — it probes Greenhouse/Ashby/Lever for the company's correct ATS slug and prints the suggested ats + slug.
2. Open portals.yml, find the "${input}" entry under tracked_companies, and update its careers_url (and any api/slug field) to the suggested WORKING ATS URL. Change ONLY this one company; preserve all other YAML structure, comments and formatting exactly.
3. Re-run \`node verify-portals.mjs\` and confirm "${input}" now shows ✅ live (not ❌).
If NO slug variant resolves, say so clearly and leave portals.yml unchanged. Never touch any other company.

End with EXACTLY one final line: VERDICT: {5 if now live, else 1}/5 — {what you changed, ≤12 words}`;
  }
  // evaluate (default) — run the REAL oferta mode + persist canonically
  return `You are running the OFFICIAL career-ops job evaluation, HEADLESS, on the user's own machine. Today is ${today}. Run the REAL career-ops evaluation — do NOT improvise your own scoring.

1. Read modes/oferta.md and follow it EXACTLY (blocks A–F, G posting-legitimacy, and the Machine Summary). Ground the fit in THIS person: read cv.md, config/profile.yml and modes/_profile.md. Use WebFetch to read the posting (you are headless — Playwright is unavailable, so use WebFetch and mark the report header "Verification: unconfirmed (batch mode)").

2. Persist the result CANONICALLY so the web and the CLI share ONE source of truth:
   a. Reserve a report number: run \`node reserve-report-num.mjs\` — its stdout is a 3-digit number (e.g. 035).
   b. Write the full report to reports/{num}-{company-slug}-${today}.md  (company-slug = company lowercased, non-alphanumerics → hyphens).
   c. Append ONE row of 9 TAB-separated columns to batch/tracker-additions/{num}-{company-slug}.tsv, in THIS exact order (real \\t tabs, status BEFORE score):
      {num}\t${today}\t{Company}\t{Role}\t{CanonicalStatus e.g. Evaluated}\t{score}/5\t❌\t[{num}](reports/{num}-{company-slug}-${today}.md)\t{one-line note}
   d. Merge into the tracker: run \`node merge-tracker.mjs\` (it dedupes by company+role+report-num, validates the status, and writes data/applications.md — NEVER edit applications.md by hand).

3. NEVER submit an application, fill no forms, contact no one. This is evaluation + persistence ONLY.

After everything above is written and merged, output EXACTLY one final line, nothing after it:
VERDICT: {score}/5 — {reason in 12 words or fewer}

Posting URL: ${input}`;
}

export async function POST(req: Request) {
  let body: { kind?: string; input?: string; cliId?: string; variant?: string; contactName?: string; contactTitle?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
  }
  const { kind = "evaluate", input, cliId, variant: rawVariant, contactName: rawContactName, contactTitle: rawContactTitle } = body;
  if (!input || !cliId) {
    return new Response(JSON.stringify({ error: "input and cliId required" }), { status: 400 });
  }
  // Free text that only ever reaches a prompt argv entry (never a shell, never
  // a filename) — capped the same way lead-feedback's reason field is, not
  // filename-validated like `variant` above.
  const contactName = typeof rawContactName === "string" ? rawContactName.trim().slice(0, 160) : undefined;
  const contactTitle = typeof rawContactTitle === "string" ? rawContactTitle.trim().slice(0, 200) : undefined;
  if (kind === "evaluate" && activeEvaluationUrls.has(input)) {
    return Response.json({ error: "This listing is already being evaluated in the background." }, { status: 409 });
  }
  // Re-validate against the real directory listing rather than trusting the
  // client string as-is — this filename ends up interpolated into a prompt
  // the spawned agent reads, so it's re-checked the same way a file path
  // would be anywhere else in this route, not just loosely sanitized.
  let variant: string | undefined;
  if (kind === "pdf" && rawVariant) {
    try {
      const variantsDir = path.join(careerOpsRoot(), "cv-variants");
      const known = fs.readdirSync(variantsDir).filter((f) => f.endsWith(".md") && f !== "README.md");
      if (known.includes(rawVariant)) variant = rawVariant;
    } catch {
      /* cv-variants/ doesn't exist — variant stays undefined, falls back to cv.md */
    }
  }
  const resolved = resolveCli(cliId);
  if (!resolved) {
    return new Response(JSON.stringify({ error: `CLI '${cliId}' not found` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { spec, binPath } = resolved;

  // These run the REAL core (modes/scripts), not just data — fail clearly if the
  // root is incomplete instead of faking it.
  const needsScript: Record<string, string> = { evaluate: "modes/oferta.md", "fix-portal": "verify-portals.mjs", pdf: "generate-pdf.mjs", outreach: "modes/contacto.md" };
  const required = needsScript[kind];
  if (required && !fs.existsSync(path.join(careerOpsRoot(), required))) {
    return new Response(
      JSON.stringify({
        error: `This needs a complete career-ops checkout (${required}). CAREER_OPS_ROOT has data only — point it at a full checkout.`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // An A–F score is meaningless without a CV to score against — the CLI would
  // hallucinate a fit narrative and still emit a VERDICT. Require cv.md first.
  if ((kind === "evaluate" || kind === "pdf" || kind === "outreach") && !fs.existsSync(path.join(careerOpsRoot(), "cv.md"))) {
    return new Response(
      JSON.stringify({ error: "Add your CV first so I can score this against you — drop it on the home page." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (kind === "outreach" && !findReportFile(input)) {
    return new Response(
      JSON.stringify({ error: "No evaluation report found for this application yet — evaluate it first." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  // Precompute deterministic scratch + final paths so the agent never chooses
  // its own filenames — the backend owns naming and, later, rendering (#2172).
  let pdfPaths: PdfPaths | undefined;
  let pdfReportFile: string | undefined;
  if (kind === "pdf") {
    pdfReportFile = findReportFile(input) ?? undefined;
    const pathsResult = resolvePdfPaths(input, today, careerOpsRoot(), findReportFile);
    if (!pathsResult.ok) {
      return new Response(JSON.stringify({ error: pathsResult.error }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    pdfPaths = pathsResult.paths;
    // Clear any stale scratch artifacts left by an earlier run of this same
    // report before the agent starts, so their existence after this run
    // genuinely proves THIS run produced them. Without this, a re-run whose
    // agent emits some output and exits cleanly but doesn't actually
    // (re)write the HTML could pass the honesty gate on a leftover file from
    // a prior attempt and render/report stale content as if it were fresh.
    for (const p of [pdfPaths.html, pdfPaths.meta]) {
      // force:true already suppresses "doesn't exist" internally, so anything
      // reaching this catch is a real failure (permissions, etc.) — silently
      // swallowing it would defeat the invariant this whole block exists for:
      // an un-cleared stale file could then pass the later existence+non-empty
      // check as if it were fresh.
      try {
        fs.rmSync(p, { force: true });
      } catch (err) {
        console.warn(`Failed to clear stale PDF scratch artifact ${p}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Same deterministic-path + clear-before-run discipline as pdfPaths above,
  // scaled down: one small text file, no render step, no format decision.
  let outreachPath: string | undefined;
  let outreachReportFile: string | undefined;
  if (kind === "outreach") {
    outreachReportFile = findReportFile(input) ?? undefined;
    const safeN = input.replace(/[^a-zA-Z0-9_-]/g, "");
    const dir = path.join(careerOpsRoot(), "output", "outreach");
    fs.mkdirSync(dir, { recursive: true });
    outreachPath = path.join(dir, `${safeN}.txt`);
    try {
      fs.rmSync(outreachPath, { force: true });
    } catch (err) {
      console.warn(`Failed to clear stale outreach draft ${outreachPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const prompt = buildPrompt({
    kind,
    input,
    memory: readMemory(),
    today,
    pdfPaths,
    reportFile: kind === "outreach" ? outreachReportFile : pdfReportFile,
    variant,
    outreachPath,
    contactName,
    contactTitle,
  });

  const isClaude = cliId === "claude";
  const isCodex = cliId === "codex";
  // Tool scope by kind (comma-separated lists; disallowedTools is the hard
  // guardrail). 'evaluate'/'fix-portal' run the REAL mode + persist canonical
  // artifacts → they need Write + Bash (reserve-report-num / merge-tracker /
  // verify-portals). 'pdf' only tailors content and writes the HTML + format
  // sidecar (Write, no Bash — deliberately: the backend renders the PDF itself
  // afterward via renderAndMarkPdf, see pdf-render.mjs; granting Bash here would
  // let the agent improvise its own render/fallback exactly like the #2172
  // incident this fix closes). 'research' stays fully read-only. Task
  // (sub-agents) is always blocked (runaway cost). NEVER auto-submits — that is
  // a prompt-level guarantee.
  const tools =
    kind === "evaluate" || kind === "fix-portal"
      ? { allowed: "Read,WebFetch,WebSearch,Write,Edit,Bash,Glob,Grep", disallowed: "Task,NotebookEdit" }
      : kind === "pdf"
        ? { allowed: "Read,WebFetch,WebSearch,Write,Edit,Bash,Glob,Grep", disallowed: "Task,NotebookEdit" }
        : kind === "outreach"
          // Contact discovery is already done (the contact was confirmed by the
          // user beforehand) — no WebFetch/WebSearch, no Bash/Edit, just enough
          // to read cv.md/the report and write the one draft file.
          ? { allowed: "Read,Write,Glob,Grep", disallowed: "Bash,Edit,NotebookEdit,Task,WebFetch,WebSearch" }
          : { allowed: "Read,WebFetch,WebSearch,Glob,Grep", disallowed: "Bash,Write,Edit,NotebookEdit,Task" };
  const args = isClaude
    ? ["-p", prompt, "--output-format", "stream-json", "--verbose", "--include-partial-messages",
       "--permission-mode", "acceptEdits",
       "--allowedTools", tools.allowed,
       "--disallowedTools", tools.disallowed]
    : spec.args(prompt);

  // For write-needing kinds, snapshot reports/ so we can verify the worker
  // actually persisted (non-Claude CLIs lack Write auth and silently no-op).
  const reportsDir = path.join(careerOpsRoot(), "reports");
  const reportNames = () => {
    try {
      return new Set(fs.readdirSync(reportsDir).filter((f) => f.endsWith(".md") && !/-RESERVED\.md$/i.test(f)));
    } catch {
      return new Set<string>();
    }
  };
  const persists = kind === "evaluate";
  const reportsBefore = persists ? reportNames() : new Set<string>();
  // Tracker-mutating runs hold a write token so a row delete can't race their merge
  // (tracker.mjs delete doesn't yet share a lock with merge-tracker — see run-registry).
  const writeToken = kind === "evaluate" || kind === "pdf" ? acquireTrackerWrite() : null;

  if (kind === "evaluate") activeEvaluationUrls.add(input);
  // Explicitly close stdin. Claude Code otherwise waits for piped input, emits
  // "no stdin data received in 3s", and can exit 1 even though the prompt was
  // correctly supplied via -p.
  const child = spawn(binPath, args, { cwd: careerOpsRoot(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  const enc = new TextEncoder();

  // `closed` + kill timer in the OUTER scope so cancel() (client disconnect) can
  // flip `closed` before the child's late handlers run, and send() is try/catch'd —
  // otherwise a late enqueue onto a closed controller throws uncaught (see #1155).
  let closed = false;
  let killer: ReturnType<typeof setTimeout> | undefined;
  let artifactPoll: ReturnType<typeof setInterval> | undefined;
  let timedOut = false;
  // pdf-kind's render+mark work (renderPdf, below) keeps running detached even
  // after the agent child closes — and even after a client disconnect fires
  // cancel(). Track its promise so cancel() can defer releasing writeToken
  // until that work actually settles, instead of releasing the tracker-delete
  // guard while mark-pdf-ready.mjs is still actively writing applications.md.
  let pdfRenderPromise: Promise<void> | null = null;
  let writeTokenReleased = false;
  const releaseWriteTokenOnce = () => {
    if (writeToken !== null && !writeTokenReleased) {
      writeTokenReleased = true;
      releaseTrackerWrite(writeToken);
    }
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let buf = "";
      let emittedText = false; // any assistant text delta → the CLI actually ran
      let sawError = false;
      let diagnostics = "";
      let lastTokens = 0; // per-run token cost from the Claude result event (#6) — local only
      let lastCostUsd: number | null = null;
      let pdfRenderStarted = false;
      // pdf-mode's agent only tailors content now (rendering moved to the
      // backend, #2172) — but its killMs still has to leave real headroom
      // inside the route's overall maxDuration (800s): the render+mark phase
      // (renderPdf, below) starts only after this timer's window and has no
      // timeout of its own, so an agent that runs close to its full budget
      // would otherwise leave the platform's hard maxDuration cutoff to kill
      // generate-pdf.mjs mid-render. 600s agent / ~200s render is ample —
      // a Chromium PDF render normally takes low tens of seconds even with a
      // cold Playwright launch.
      const killMs = kind === "pdf" || kind === "evaluate" ? 600_000 : 285_000;
      killer = setTimeout(() => {
        timedOut = true;
        send({ type: "status", label: "Time limit reached — stopping safely" });
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
      }, killMs);
      const send = (obj: unknown) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(JSON.stringify(obj) + "\n")); } catch { closed = true; }
      };
      const close = () => {
        if (!closed) {
          closed = true;
          if (killer) clearTimeout(killer);
          if (artifactPoll) clearInterval(artifactPoll);
          if (kind === "evaluate") activeEvaluationUrls.delete(input);
          releaseWriteTokenOnce();
          try { controller.close(); } catch { /* */ }
        }
      };

      // Give immediate confirmation that the local process launched. Some CLIs
      // take a while to initialize before their first stdout event.
      send({ type: "status", label: `Started ${spec.name}` });

      // Agents sometimes persist the complete report + tracker row and then
      // continue researching or composing, leaving the UI spinning for many
      // minutes after the useful work is done. The artifacts are the source of
      // truth: once both exist, finish the worker immediately and stop the
      // redundant agent process.
      if (kind === "evaluate") {
        artifactPoll = setInterval(() => {
          const after = reportNames();
          const fresh = [...after].find((name) => !reportsBefore.has(name));
          if (!fresh) return;
          let tracker = "";
          try { tracker = fs.readFileSync(path.join(careerOpsRoot(), "data", "applications.md"), "utf8"); } catch { return; }
          if (!tracker.includes(fresh)) return;
          let score = "";
          let reason = "";
          try {
            const reportText = fs.readFileSync(path.join(reportsDir, fresh), "utf8");
            score = reportText.match(/^\*\*Score:\*\*\s*([0-5](?:\.\d+)?)\/5/im)?.[1] ?? "";
            reason = reportText
              .match(/^\|\s*TL;?DR\s*\|\s*(.*?)\s*\|\s*$/im)?.[1]
              ?.replace(/[*_`]/g, "")
              .trim() ?? "";
          } catch { /* report existence was already verified */ }
          const reportId = fresh.match(/^(\d+)/)?.[1]?.replace(/^0+(?=\d)/, "") ?? "";
          if (reportId) send({ type: "artifact", reportId });
          if (score) send({ type: "text", text: `\nVERDICT: ${score}/5 — ${reason || "Evaluation saved in Pipeline"}\n` });
          send({ type: "done", tokens: lastTokens, costUsd: lastCostUsd });
          try { child.kill("SIGTERM"); } catch { /* already exited */ }
          close();
        }, 1_000);
      }

      child.stdout.on("data", (d: Buffer) => {
        if (closed) return;
        if (isCodex) {
          buf += d.toString();
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            try {
              const ev = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string; command?: string }; message?: string };
              if (ev.type === "item.started" && ev.item?.type) send({ type: "status", label: ev.item.type === "command_execution" ? "Saving evaluation artifacts" : "Working on evaluation" });
              if (ev.type === "item.completed") {
                if (ev.item?.type === "agent_message" && ev.item.text) {
                  emittedText = true;
                  send({ type: "text", text: ev.item.text });
                } else if (ev.item?.type === "command_execution") {
                  send({ type: "tool", name: "Bash" });
                }
              }
              if (ev.type === "error" && ev.message) {
                sawError = true;
                diagnostics += `${ev.message}\n`;
              }
            } catch {
              // Preserve unexpected Codex output as useful diagnostics.
              emittedText = true;
              send({ type: "text", text: line + "\n" });
            }
          }
          return;
        }
        if (!isClaude) {
          emittedText = true;
          send({ type: "text", text: d.toString() });
          return;
        }
        buf += d.toString();
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "stream_event") {
              const e = ev.event;
              if (e?.type === "content_block_start" && e.content_block?.type === "tool_use") {
                send({ type: "tool", name: e.content_block.name });
              } else if (e?.type === "content_block_delta" && e.delta?.text) {
                emittedText = true;
                send({ type: "text", text: e.delta.text });
              }
            } else if (ev.type === "system" && ev.subtype === "init") {
              send({ type: "status", label: "Agent ready" });
            } else if (ev.type === "result") {
              // Capture the per-run cost; the authoritative "done" is sent on close
              // (so the honesty gate decides done-vs-error first). Tokens = the same
              // formula /api/usage uses: input + output + cache-creation.
              const u = ev.usage || {};
              lastTokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
              if (typeof ev.total_cost_usd === "number") lastCostUsd = ev.total_cost_usd;
            }
          } catch {
            /* partial line */
          }
        }
      });
      child.stderr.on("data", (d: Buffer) => {
        const s = d.toString();
        // Codex emits optional MCP/plugin startup warnings to stderr (for
        // example an unauthenticated Stripe connector) even when the requested
        // task completes successfully. Its --json stdout and exit code are the
        // authoritative task channel; treating unrelated plugin noise as a
        // failed evaluation caused real reports to be rejected after minutes.
        if (isCodex) return;
        diagnostics += s;
        // Authentication diagnostics are useful, but don't terminate the UI
        // on stderr alone: several CLIs print recoverable startup warnings.
        if (isAuthenticationDiagnostic(s)) {
          sawError = true;
        }
      });
      // Render + mark-tracker-ready live in pdf-render.mjs (plain, dependency-
      // injected, unit-tested) so the render-then-mark orchestration isn't
      // buried untested inside this transport-layer closure. Runs generate-
      // pdf.mjs and mark-pdf-ready.mjs as plain Node child processes — no agent
      // CLI or its sandbox involved — so a browser launch never depends on an
      // interactive approval nobody is present to grant in a headless/web-
      // triggered run (#2172). The tracker is marked ✅ only after a CONFIRMED
      // successful render, not optimistically — same honesty-gate discipline as
      // the evaluate path below.
      const renderPdf = async (paths: PdfPaths) => {
        send({ type: "status", label: "Rendering PDF…" });
        // renderAndMarkPdf is designed to resolve, never throw — but this is
        // the one place nothing else awaits or catches this promise (cancel()
        // only attaches a .finally for the write-token release), so an
        // unexpected exception here must still close the stream instead of
        // leaving it — and the write-token — open until process shutdown.
        try {
          const result = await renderAndMarkPdf({
            spawnFn: spawn,
            execPath: process.execPath,
            root: careerOpsRoot(),
            pdfPaths: paths,
            reportNum: paths.reportNum,
          });
          if (result.kind === "render-failed") {
            send({ type: "error", msg: result.error.slice(0, 200) });
            return;
          }
          // Non-fatal issues (missing format sidecar, tracker not marked) still
          // surface here rather than only in a server log nobody sees.
          for (const w of result.warnings) send({ type: "text", text: `⚠️ ${w}\n` });
          send({ type: "done", tokens: lastTokens, costUsd: lastCostUsd });
        } catch (e) {
          send({ type: "error", msg: `PDF rendering crashed unexpectedly: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200) });
        } finally {
          close();
        }
      };

      if (kind === "pdf" && pdfPaths) {
        artifactPoll = setInterval(() => {
          if (pdfRenderStarted || closed) return;
          const ready = [pdfPaths!.html, pdfPaths!.meta].every((p) => {
            try { return fs.statSync(p).size > 0; } catch { return false; }
          });
          if (!ready) return;
          pdfRenderStarted = true;
          if (artifactPoll) clearInterval(artifactPoll);
          if (killer) clearTimeout(killer);
          try { child.kill("SIGTERM"); } catch { /* already exited */ }
          pdfRenderPromise = renderPdf(pdfPaths!);
        }, 1_000);
      }

      child.on("error", (e) => { send({ type: "error", msg: e.message }); close(); });
      child.on("close", (code, signal) => {
        // A client disconnect can fire cancel() (which kills `child`) before
        // this event finally arrives — killing a process doesn't make its
        // 'close' event disappear, just delays it. Without this guard a pdf
        // run could still start a brand-new render (and re-touch the tracker)
        // after the stream — and its writeToken guard — is already gone.
        if (closed || pdfRenderStarted) return;
        const cleanExit = code === 0; // non-zero OR null (killed/signal) = NOT clean
        // Shared by both honesty gates below: a CLI that produced no output at
        // all is the same failure mode whether it was evaluating or tailoring
        // a PDF — one place for the condition/message pair instead of two.
        const noOutputError = (): string | null => {
          if (timedOut || isAuthenticationDiagnostic(diagnostics)) {
            return classifyRunFailure({ timedOut, timeoutMs: killMs, diagnostics, code, signal, emittedText }).message;
          }
          if (!cleanExit) return classifyRunFailure({ timedOut, timeoutMs: killMs, diagnostics, code, signal, emittedText }).message;
          if (!emittedText && !sawError) return "The CLI exited successfully but produced no evaluation output. Run it directly to check its headless mode, then retry.";
          return null;
        };

        if (kind === "pdf") {
          // Non-empty, not just existing: paired with clearing pdfPaths.html/meta
          // before the agent started (above), this proves the file is both fresh
          // (not a leftover from an earlier run of this same report) and real
          // (not a zero-byte artifact from a half-finished write).
          const wroteHtml = pdfPaths !== undefined && fs.existsSync(pdfPaths.html) && fs.statSync(pdfPaths.html).size > 0;
          // Same honesty-gate shape as below, plus the actual bug-fix check: verify
          // a real HTML artifact exists before ever reporting success (previously
          // nothing checked this, so an agent that improvised past a failure — e.g.
          // falling back to wkhtmltopdf — could still report a fake "done").
          const baseErr = noOutputError();
          if (baseErr) {
            send({ type: "error", msg: baseErr });
          } else if (!wroteHtml || !cleanExit || sawError || !pdfPaths) {
            send({ type: "error", msg: "This run didn't produce a tailored CV to render, so no PDF was generated — re-run it to verify." });
          } else {
            // Tracked so cancel() can defer releasing writeToken until this
            // settles; close() happens once rendering finishes, not here.
            pdfRenderPromise = renderPdf(pdfPaths);
            return;
          }
          return close();
        }

        const reportsAfter = reportNames();
        const wroteReport = [...reportsAfter].some((name) => !reportsBefore.has(name));
        // Honesty gate (#9): a green "done" with a parsed score requires a CLEAN exit,
        // real output, AND (for evaluations) a report actually written. Anything else
        // is surfaced — an errored run must never be banked as a confident score.
        const baseErr = noOutputError();
        if (baseErr) {
          send({ type: "error", msg: baseErr });
        } else if (persists && !wroteReport) {
          // The worker ran but never wrote the report/tracker row (e.g. a CLI
          // without file-write authorization) — surface it instead of a fake score.
          send({ type: "error", msg: "The evaluation finished without saving its detailed report. Retry it; Codex and Claude Code are both supported." });
        } else if (!cleanExit || sawError) {
          // Produced output (maybe even a report) but did NOT finish cleanly — flag it
          // instead of recording a confident score off a half-finished run.
          send({ type: "error", msg: "This run hit an error before finishing, so it isn't recorded as a confident result — re-run it to verify." });
        } else if (kind === "outreach" && !(outreachPath && fs.existsSync(outreachPath) && fs.statSync(outreachPath).size > 0)) {
          // Same honesty-gate shape as pdf's wroteHtml check — a clean exit alone
          // doesn't prove the draft file actually landed on disk.
          send({ type: "error", msg: "This run didn't produce a draft message — re-run it to verify." });
        } else {
          send({ type: "done", tokens: lastTokens, costUsd: lastCostUsd });
        }
        close();
      });
    },
    cancel() {
      closed = true;
      // An evaluation is a backend artifact-producing job. Navigating away or
      // reloading the page must not kill it three minutes into the run. Leave
      // the bounded child alive; its existing kill timer still caps it at
      // 285s, and release the tracker guard when the process actually exits.
      if (kind === "evaluate") {
        child.once("close", () => {
          activeEvaluationUrls.delete(input);
          if (artifactPoll) clearInterval(artifactPoll);
          releaseWriteTokenOnce();
        });
        return;
      }
      if (killer) clearTimeout(killer);
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      if (pdfRenderPromise) {
        // Render/mark keeps running after this client disconnects — wait for
        // it to settle before releasing the guard, so a concurrent tracker
        // delete can't race mark-pdf-ready.mjs's still-in-flight write.
        pdfRenderPromise.finally(releaseWriteTokenOnce);
      } else {
        releaseWriteTokenOnce();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
