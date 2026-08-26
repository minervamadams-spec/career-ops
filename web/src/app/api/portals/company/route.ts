import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Adds ONE company to portals.yml's tracked_companies (the setup wizard's
// "job sources" step) — same seed-from-example / atomic-write-with-backup
// pattern as /api/portals (title_filter) and /api/profile. Auto-detection
// (scan.mjs's providers/*.mjs, see portals.yml's own "Provider
// auto-detection" comment block) works off careers_url alone for most ATS
// platforms (Greenhouse, Ashby, Lever, Workday, etc.) — this route just adds
// the entry, it doesn't need to know which provider matches.
export async function POST(req: Request) {
  let body: { name?: string; careersUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const name = body.name?.trim();
  const careersUrl = body.careersUrl?.trim();
  if (!name || !careersUrl) return Response.json({ error: "name and careersUrl required" }, { status: 400 });
  if (!/^https?:\/\//i.test(careersUrl)) return Response.json({ error: "careersUrl must start with http(s)://" }, { status: 400 });

  const root = careerOpsRoot();
  const file = path.join(root, "portals.yml");
  let doc: Record<string, unknown> = {};
  try {
    doc = (yaml.load(fs.readFileSync(file, "utf8")) as Record<string, unknown>) || {};
  } catch {
    try {
      doc = (yaml.load(fs.readFileSync(path.join(root, "templates", "portals.example.yml"), "utf8")) as Record<string, unknown>) || {};
    } catch {
      doc = {};
    }
  }

  const companies = Array.isArray(doc.tracked_companies) ? [...(doc.tracked_companies as unknown[])] : [];
  const dup = companies.some((c) => isObj(c) && String(c.name || "").toLowerCase() === name.toLowerCase());
  if (dup) return Response.json({ ok: true, alreadyTracked: true });

  companies.push({ name, careers_url: careersUrl, notes: "added via setup wizard", enabled: true });
  doc.tracked_companies = companies;

  try {
    atomicWriteWithBackup(file, yaml.dump(doc, { lineWidth: 100, noRefs: true }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "write failed" }, { status: 500 });
  }
  return Response.json({ ok: true, count: companies.length });
}
