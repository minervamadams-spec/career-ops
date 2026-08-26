import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readContacts, careerOpsRoot, rootScript } from "@/lib/career-ops";

const exec = promisify(execFile);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const company = new URL(req.url).searchParams.get("company")?.trim().toLowerCase();
  const contacts = readContacts().filter((c) => !company || c.company.toLowerCase() === company);
  return Response.json({ contacts });
}

export async function POST(req: Request) {
  const contact = await req.json();
  if (!contact?.confirmed) return Response.json({ error: "Confirm the contact before saving it." }, { status: 400 });
  const saved = { ...contact, confirmed: undefined };
  try {
    await exec(process.execPath, [rootScript("contacts"), "add", JSON.stringify(saved)], { cwd: careerOpsRoot() });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Could not save contact" }, { status: 500 });
  }
}
