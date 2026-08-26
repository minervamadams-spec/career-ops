import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { atomicWrite } from "@/lib/core/safe-write";
import { careerOpsRoot, rememberFact } from "@/lib/career-ops";
import { categorizePassReason } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readFile(file: string) {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

export async function GET() {
  const file = path.join(careerOpsRoot(), "data", "lead-feedback.jsonl");
  const entries = readFile(file).split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line) as Record<string, unknown>]; } catch { return []; }
  });
  return NextResponse.json({
    dismissedUrls: [...new Set(entries.filter((e) => e.decision === "dismissed" && typeof e.url === "string").map((e) => String(e.url)))],
    entries: entries.slice(-200),
  });
}

function closePipelineRow(root: string, url: string): boolean {
  const file = path.join(root, "data", "pipeline.md");
  const current = readFile(file);
  if (!current) return false;
  let changed = false;
  const next = current.split("\n").map((line) => {
    if (!changed && /^\s*-\s*\[ \]/.test(line) && line.includes(url)) {
      changed = true;
      return line.replace("[ ]", "[x]");
    }
    return line;
  }).join("\n");
  if (changed) atomicWrite(file, next);
  return changed;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const url = String(body.url ?? "").trim();
  const company = String(body.company ?? "").trim().slice(0, 160);
  const role = String(body.role ?? "").trim().slice(0, 200);
  const reason = String(body.reason ?? "").trim().replace(/\s+/g, " ").slice(0, 300);
  const source = body.source === "today" ? "today" : body.source === "pipeline" ? "pipeline" : "explore";
  if (!/^https?:\/\//i.test(url) || !company || !role) return NextResponse.json({ error: "url, company and role required" }, { status: 400 });

  const category = categorizePassReason(reason);
  const root = careerOpsRoot();
  const file = path.join(root, "data", "lead-feedback.jsonl");
  const entry = { timestamp: new Date().toISOString(), decision: "dismissed", category, reason: reason || null, company, role, url, source, inPipeline: body.inPipeline === true };
  const current = readFile(file);
  atomicWrite(file, `${current}${current && !current.endsWith("\n") ? "\n" : ""}${JSON.stringify(entry)}\n`);
  // A dismissal is global: remove the pending row even when the action came
  // from Explore, where the client may not yet know that the URL is also in the
  // pipeline. This keeps every surface in sync and makes the action durable.
  const pipelineClosed = closePipelineRow(root, url);
  if (reason) rememberFact(`Lead preference [${category}]: passed on ${company} (${role}) — ${reason}`);
  return NextResponse.json({ ok: true, category, pipelineClosed });
}
