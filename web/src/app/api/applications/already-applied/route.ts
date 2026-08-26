import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { careerOpsRoot, readApplications, rootScript } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { company?: string; role?: string; url?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const company = String(body.company ?? "").replace(/[|\t\r\n]/g, " ").trim().slice(0, 200);
  const role = String(body.role ?? "").replace(/[|\t\r\n]/g, " ").trim().slice(0, 300);
  const url = String(body.url ?? "").trim().slice(0, 2_000);
  if (!company || !role || !/^https?:\/\//i.test(url)) return Response.json({ error: "company, role, and URL required" }, { status: 400 });
  const existing = readApplications().find((app) => app.company.toLowerCase() === company.toLowerCase() && app.role.toLowerCase() === role.toLowerCase());
  if (existing) {
    const status = spawnSync(process.execPath, [rootScript("set-status"), existing.n, "Applied", "--note", "Already applied before discovery; exact date not provided"], { cwd: careerOpsRoot(), encoding: "utf8" });
    if (status.status !== 0) return Response.json({ error: status.stderr || status.stdout || "could not update tracker" }, { status: 500 });
    return Response.json({ ok: true, n: existing.n });
  }

  const reserve = spawnSync(process.execPath, [rootScript("reserve-report-num")], { cwd: careerOpsRoot(), encoding: "utf8" });
  const num = reserve.stdout.trim().match(/\d{3}/)?.[0];
  if (reserve.status !== 0 || !num) return Response.json({ error: "could not reserve a tracker number" }, { status: 500 });
  const additions = path.join(careerOpsRoot(), "batch", "tracker-additions");
  fs.mkdirSync(additions, { recursive: true });
  const file = path.join(additions, `${num}-already-applied.tsv`);
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(file, `${num}\t${today}\t${company}\t${role}\tApplied\t—\t❌\t—\tAlready applied before discovery; exact date not provided; source: ${url}\n`, "utf8");
  const merge = spawnSync(process.execPath, [rootScript("merge-tracker")], { cwd: careerOpsRoot(), encoding: "utf8" });
  spawnSync(process.execPath, [rootScript("reserve-report-num"), "--release", num], { cwd: careerOpsRoot(), encoding: "utf8" });
  if (merge.status !== 0) return Response.json({ error: merge.stderr || merge.stdout || "could not update tracker" }, { status: 500 });
  return Response.json({ ok: true, n: String(parseInt(num, 10)) });
}
