import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { canonicalizeStatus } from "@/lib/core/states";
import { resolveSkipReasonId, skipReasonLabel, readSkipReasons } from "@/lib/core/skip-reasons";
import { atomicWrite } from "@/lib/core/safe-write";
import { categorizePassReason } from "@/lib/format";

// Writeback: UPDATE the status cell of an EXISTING tracker row only. Never adds
// rows — per the core data contract, new rows go through the TSV + merge flow.
// HARDENED: validate against the 8 canonical states (states.yml SSOT); reject any
// value with table-breaking chars (| \r \n **) that would scramble the row; detect
// the Status column from the header (8- and 9-col layouts); atomic write.
export async function POST(req: Request) {
  let body: { n?: string; status?: string; note?: string; reasonId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { n, status, note: rawNote, reasonId: rawReasonId } = body;
  if (!n || typeof status !== "string" || !status.trim()) {
    return NextResponse.json({ error: "n and status required" }, { status: 400 });
  }
  if (/[|\r\n*]/.test(status)) {
    return NextResponse.json({ error: "invalid status (table-breaking characters)" }, { status: 400 });
  }
  const canon = canonicalizeStatus(status);
  if (!canon) {
    return NextResponse.json({ error: `not a canonical status: ${status}` }, { status: 400 });
  }
  // Optional free-text detail, appended after the reason (or standalone for any
  // other status). Sanitized the same way set-status.mjs's cell() helper treats
  // free text headed for a table cell — strip table-breaking chars rather than
  // reject, since this is text the user typed, not a controlled value like status.
  const freeText =
    typeof rawNote === "string" && rawNote.trim()
      ? rawNote.replace(/[\r\n]+/g, " ").replace(/\s*\|\s*/g, " / ").trim().slice(0, 300)
      : null;

  // A transition INTO SKIP is a self-filter decision (patterns.md's
  // classification table: SKIP = self-filtered, Discarded = company said no /
  // offer closed) — mirrors set-status.mjs's own --reason requirement so the
  // CLI and the UI can't drift on when a reason is mandatory. Discarded no
  // longer prompts for one at all (see status-select.tsx / decision-card.tsx /
  // leads-table.tsx — every UI path that used to write Discarded+"Passed:" now
  // writes SKIP+reasonId instead).
  let note: string | null = freeText;
  if (canon === "SKIP") {
    if (!rawReasonId || typeof rawReasonId !== "string") {
      return NextResponse.json({ error: "reasonId required when status is SKIP" }, { status: 400 });
    }
    const resolvedId = resolveSkipReasonId(rawReasonId);
    if (!resolvedId) {
      const valid = readSkipReasons().map((r) => r.id).join(", ");
      return NextResponse.json({ error: `unrecognized reasonId "${rawReasonId}". Valid: ${valid}` }, { status: 400 });
    }
    const label = skipReasonLabel(resolvedId);
    note = `reason=${resolvedId} — Passed: ${label}${freeText ? ` — ${freeText}` : ""}`;
  }

  const file = path.join(careerOpsRoot(), "data", "applications.md");
  let md: string;
  try {
    md = fs.readFileSync(file, "utf8");
  } catch {
    return NextResponse.json({ error: "tracker not found" }, { status: 404 });
  }

  const lines = md.split("\n");
  // Find the Status (and, if present, Notes/Company/Role) column indices from
  // the header row (robust to 8- vs 9-col). Defaults mirror the legacy fixed
  // layout.
  let statusIdx = 6;
  let notesIdx: number | null = 9;
  let companyIdx = 3;
  let roleIdx = 4;
  for (const l of lines) {
    if (!l.trim().startsWith("|")) continue;
    const cells = l.split("|").map((c) => c.trim().toLowerCase());
    const idx = cells.findIndex((c) => c === "status");
    if (idx > 0) {
      statusIdx = idx;
      const nIdx = cells.findIndex((c) => c === "notes");
      notesIdx = nIdx > 0 ? nIdx : null;
      const cIdx = cells.findIndex((c) => c === "company");
      if (cIdx > 0) companyIdx = cIdx;
      const rIdx = cells.findIndex((c) => c === "role");
      if (rIdx > 0) roleIdx = rIdx;
      break;
    }
    if (/^:?-{2,}:?$/.test(cells[1] ?? "")) break; // hit the separator → no header match, keep default
  }

  let changed = false;
  let noteApplied = false;
  let rowCompany = "";
  let rowRole = "";
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    const parts = lines[i].split("|");
    if (parts.length < 8) continue;
    if (parts[1].trim() !== String(n)) continue;
    if (statusIdx >= parts.length - 1) continue; // guard malformed row
    rowCompany = (parts[companyIdx] ?? "").trim();
    rowRole = (parts[roleIdx] ?? "").trim();
    parts[statusIdx] = ` ${canon} `;
    changed = true;
    // Idempotent, delimiter-aware append — same rule set-status.mjs's --note
    // uses — so a retried request never duplicates the same reason.
    if (note && notesIdx != null) {
      while (parts.length <= notesIdx) parts.push("");
      const existing = (parts[notesIdx] ?? "").trim();
      const hasNote =
        existing === note || existing.startsWith(`${note}; `) || existing.endsWith(`; ${note}`) || existing.includes(`; ${note}; `);
      if (!hasNote) {
        parts[notesIdx] = ` ${existing && existing !== "—" && existing !== "-" ? `${existing}; ${note}` : note} `;
        noteApplied = true;
      }
    }
    lines[i] = parts.join("|");
    break;
  }
  if (!changed) return NextResponse.json({ error: "row not found" }, { status: 404 });

  try {
    atomicWrite(file, lines.join("\n"));
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
  // A scored application has no URL to key a dismissal on (readDismissedLeadUrls
  // needs one) — some rows (e.g. a scan-only entry) don't even have one to give.
  // But "why I'm passing" still matters at the company level once it's a
  // location reason (fixed per employer, not per posting) — see
  // readLocationExcludedCompanies, which only reads category+company, not url.
  // Recording it here means passing on a role from the report page generalizes
  // the same way passing on a raw lead from Explore/Pipeline already does.
  // SKIP only — Discarded means "company said no / offer closed" now (patterns.md's
  // classification table), never a self-filter decision, so it must not feed the
  // location-exclusion / lead-feedback learning loop that "why I'm passing" drives.
  if (note && canon === "SKIP" && rowCompany) {
    try {
      const category = categorizePassReason(note);
      const feedbackFile = path.join(careerOpsRoot(), "data", "lead-feedback.jsonl");
      let current = "";
      try {
        current = fs.readFileSync(feedbackFile, "utf8");
      } catch {
        /* first entry */
      }
      const entry = {
        timestamp: new Date().toISOString(),
        decision: "dismissed",
        category,
        reason: note,
        company: rowCompany,
        role: rowRole,
        url: `app:${n}`,
        source: "status",
        inPipeline: false,
      };
      atomicWrite(feedbackFile, `${current}${current && !current.endsWith("\n") ? "\n" : ""}${JSON.stringify(entry)}\n`);
    } catch {
      /* best-effort — the status write above already succeeded and is the source of truth */
    }
  }
  return NextResponse.json({ ok: true, status: canon, noteApplied });
}
