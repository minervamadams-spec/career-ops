import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";

// Toggle the board's "Applying" bucket for a row: a plain-text `applying=yes`
// marker at the front of the Notes cell, NOT a canonical status (see
// AGENTS.md's `track=` notes convention — same "no schema/column migration
// needed" reasoning applies here). Only touches the Notes cell of an EXISTING
// row; never adds rows, per the core data contract (new rows go through the
// TSV + merge-tracker.mjs flow, same boundary /api/status respects for the
// Status cell).
export async function POST(req: Request) {
  let body: { n?: string; applying?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { n, applying } = body;
  if (!n || typeof applying !== "boolean") {
    return NextResponse.json({ error: "n and applying (boolean) required" }, { status: 400 });
  }

  const file = path.join(careerOpsRoot(), "data", "applications.md");
  let md: string;
  try {
    md = fs.readFileSync(file, "utf8");
  } catch {
    return NextResponse.json({ error: "tracker not found" }, { status: 404 });
  }

  const lines = md.split("\n");
  // Find the Notes column index from the header row (robust to 8- vs 9-col,
  // and to a migrated Via column shifting Notes over) — same approach as
  // /api/status's Status-column lookup.
  let notesIdx = -1;
  for (const l of lines) {
    if (!l.trim().startsWith("|")) continue;
    const cells = l.split("|").map((c) => c.trim().toLowerCase());
    const idx = cells.findIndex((c) => c === "notes");
    if (idx > 0) {
      notesIdx = idx;
      break;
    }
    if (/^:?-{2,}:?$/.test(cells[1] ?? "")) break;
  }
  if (notesIdx < 0) return NextResponse.json({ error: "no Notes column found" }, { status: 500 });

  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    const parts = lines[i].split("|");
    if (parts.length < 8) continue;
    if (parts[1].trim() !== String(n)) continue;
    if (notesIdx >= parts.length - 1) continue; // guard malformed row

    const current = parts[notesIdx].trim();
    const withoutFlag = current.replace(/^applying=yes\s*(—|--)?\s*/i, "");
    const next = applying ? (withoutFlag ? `applying=yes — ${withoutFlag}` : "applying=yes") : withoutFlag;
    parts[notesIdx] = ` ${next} `;
    lines[i] = parts.join("|");
    changed = true;
    break;
  }
  if (!changed) return NextResponse.json({ error: "row not found" }, { status: 404 });

  try {
    atomicWrite(file, lines.join("\n"));
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, applying });
}
