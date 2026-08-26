import { appendActivity, sanitizeActivityEvent } from "@/lib/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const event = sanitizeActivityEvent(body);
  if (!event) return Response.json({ error: "invalid activity event" }, { status: 400 });
  appendActivity(event);
  return new Response(null, { status: 204 });
}
