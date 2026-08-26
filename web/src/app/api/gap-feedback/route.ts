import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { gap?: string; details?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const gap = String(body.gap ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  const details = String(body.details ?? "").replace(/\s+/g, " ").trim().slice(0, 2_000);
  if (!gap || !details) return Response.json({ error: "gap and experience details required" }, { status: 400 });
  const profilePath = path.join(careerOpsRoot(), "modes", "_profile.md");
  let profile = fs.readFileSync(profilePath, "utf8");
  const heading = "## Confirmed experience corrections";
  if (!profile.includes(heading)) profile = profile.trimEnd() + `\n\n${heading}\n`;
  const line = `- **${gap.replace(/[*_[\]`]/g, "")}**: ${details.replace(/[*_[\]`]/g, "")}`;
  if (!profile.includes(line)) profile = profile.trimEnd() + `\n${line}\n`;
  await atomicWrite(profilePath, profile);
  return Response.json({ ok: true });
}
