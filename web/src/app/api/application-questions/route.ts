import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, readApplications } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = { question: string; answer: string };
type Draft = { company: string; role: string; updatedAt: string; items: Item[] };
type Store = Record<string, Draft>;

const file = () => path.join(careerOpsRoot(), "data", "application-drafts.json");

function readStore(): Store {
  try {
    const value = JSON.parse(fs.readFileSync(file(), "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function validId(value: string | null): value is string {
  return !!value && /^\d+$/.test(value);
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!validId(id)) return Response.json({ error: "valid application id required" }, { status: 400 });
  return Response.json({ draft: readStore()[id] ?? null });
}

export async function POST(req: Request) {
  let body: { id?: string; items?: Item[] };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  if (!validId(body.id ?? null)) return Response.json({ error: "valid application id required" }, { status: 400 });
  const app = readApplications().find((entry) => parseInt(entry.n, 10) === parseInt(body.id!, 10));
  if (!app) return Response.json({ error: "application not found" }, { status: 404 });
  if (!Array.isArray(body.items) || body.items.length > 30) return Response.json({ error: "up to 30 questions allowed" }, { status: 400 });
  const items = body.items
    .map((item) => ({ question: String(item?.question ?? "").trim().slice(0, 2_000), answer: String(item?.answer ?? "").trim().slice(0, 10_000) }))
    .filter((item) => item.question);
  const store = readStore();
  store[body.id!] = { company: app.company, role: app.role, updatedAt: new Date().toISOString(), items };
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  await atomicWrite(file(), JSON.stringify(store, null, 2) + "\n");
  return Response.json({ ok: true, draft: store[body.id!] });
}
