import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads back the draft the "outreach" run kind wrote to
// output/outreach/{n}.txt — mirrors /api/cv-pdf's read-the-artifact-back
// shape for the pdf kind, just for plain text instead of a rendered file.
export async function GET(req: Request) {
  const n = new URL(req.url).searchParams.get("n") || "";
  const safeN = n.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeN) return Response.json({ error: "n required" }, { status: 400 });
  try {
    const text = fs.readFileSync(path.join(careerOpsRoot(), "output", "outreach", `${safeN}.txt`), "utf8").trim();
    if (!text) return Response.json({ draft: null });
    return Response.json({ draft: text });
  } catch {
    return Response.json({ draft: null });
  }
}
