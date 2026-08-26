import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wires jd-skill-gap.mjs (zero-LLM, cv.md vs a JD) into the web app — same
// script the CLI's `upskill`/`patterns` flows already trust, no reimplemented
// classification logic. jd-skill-gap.mjs takes a FILE path, not stdin, so the
// pasted JD is written to a throwaway temp file (NOT jds/ — that's the
// canonical capture archive per AGENTS.md, and a fit-check paste that never
// becomes a tracked application shouldn't live there) and removed after.
export async function POST(req: Request) {
  let body: { jdText?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const jdText = body.jdText?.trim();
  if (!jdText) return Response.json({ error: "jdText required" }, { status: 400 });

  const script = rootScript("jd-skill-gap");
  if (!fs.existsSync(script)) return Response.json({ available: false, error: "jd-skill-gap.mjs not found" }, { status: 404 });

  const cvPath = path.join(careerOpsRoot(), "cv.md");
  if (!fs.existsSync(cvPath)) {
    return Response.json({ available: false, error: "cv.md not found — add your CV first (see the CV tab)" }, { status: 404 });
  }

  const tmpFile = path.join(os.tmpdir(), `co-fitcheck-${randomUUID()}.md`);
  fs.writeFileSync(tmpFile, jdText, "utf8");

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile("node", [script, tmpFile], { cwd: careerOpsRoot(), timeout: 15_000 }, (err, out, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(out || "");
      });
    });
    const parsed = JSON.parse(stdout);
    return Response.json({ available: true, ...parsed });
  } catch (e) {
    return Response.json({ available: false, error: e instanceof Error ? e.message : "fit-check failed" }, { status: 500 });
  } finally {
    fs.rm(tmpFile, () => {});
  }
}
