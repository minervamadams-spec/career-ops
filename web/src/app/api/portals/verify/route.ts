import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Orchestrates the core's verify-portals.mjs (#1016) — the SAME ATS-slug
// validator the CLI uses. Catches the silent 404s that quietly drop a company
// from every future scan (= lost offers). We parse its console output; we do NOT
// reimplement the validation.
const STATUS: Record<string, "live" | "empty" | "broken" | "skipped"> = {
  "✅": "live",
  "🟡": "empty",
  "❌": "broken",
  "➖": "skipped",
};

export async function GET() {
  const root = careerOpsRoot();
  const verifyPortals = rootScript("verify-portals");
  if (!fs.existsSync(verifyPortals)) {
    return Response.json({ available: false, configured: false, companies: [] });
  }
  if (!fs.existsSync(path.join(root, "portals.yml"))) {
    return Response.json({ available: true, configured: false, companies: [] });
  }

  const stdout = await new Promise<string>((resolve) => {
    execFile(
      "node",
      [verifyPortals],
      { cwd: root, timeout: 110_000, maxBuffer: 4 * 1024 * 1024 },
      (_e, out, err) => resolve((out || "") + (err || "")),
    );
  });

  // Map name -> careers_url from the real portals.yml so each row can link out
  // to the actual careers page (#2116 — rows were unclickable dead text).
  const careersUrlByName = new Map<string, string>();
  try {
    const doc = yaml.load(fs.readFileSync(path.join(root, "portals.yml"), "utf8")) as { tracked_companies?: unknown } | null;
    const list = Array.isArray(doc?.tracked_companies) ? doc!.tracked_companies : [];
    for (const c of list as unknown[]) {
      if (c && typeof c === "object" && "name" in c && "careers_url" in c) {
        const rec = c as Record<string, unknown>;
        if (typeof rec.name === "string" && typeof rec.careers_url === "string") {
          careersUrlByName.set(rec.name, rec.careers_url);
        }
      }
    }
  } catch {
    /* best-effort — rows just won't be clickable */
  }

  const companies: { name: string; status: string; detail: string; careersUrl?: string }[] = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^\s*(✅|🟡|❌|➖)\s+(.+?)\s+—\s+(.*)$/);
    if (m) {
      const name = m[2].trim();
      companies.push({ name, status: STATUS[m[1]] ?? "unknown", detail: m[3].trim(), careersUrl: careersUrlByName.get(name) });
    }
  }
  return Response.json({ available: true, configured: true, companies });
}
