import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily-scan time preference → config/profile.yml → automation.daily_scan_time.
// Mirrors /api/followups/cadence's merge-safe write pattern exactly.
//
// IMPORTANT — this does NOT itself reschedule anything. The actual trigger
// (the "career-ops-daily-scan" scheduled task) lives in Claude's own
// account-level scheduler, which only an interactive Claude Code session can
// read or modify — verified directly: a headless CLI process (the same kind
// this app spawns for evaluate/fix-portal/fix-bug) cannot see it at all
// (CronList from that context returns "No scheduled jobs"). So a save here
// ALSO queues an agent-inbox item (the project's existing "ask the next
// session to do this" mechanism, modes/agent-inbox.md) with the exact cron
// expression precomputed, so applying it needs zero interpretation — the
// next interactive session just runs the one tool call.

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function GET() {
  const file = path.join(careerOpsRoot(), "config", "profile.yml");
  let time: string | null = null;
  if (fs.existsSync(file)) {
    try {
      const parsed = yaml.load(fs.readFileSync(file, "utf8"));
      const profile = isObj(parsed) ? parsed : {};
      const automation = isObj(profile.automation) ? profile.automation : {};
      const t = automation.daily_scan_time;
      if (typeof t === "string" && TIME_RE.test(t)) time = t;
    } catch {
      /* unreadable/malformed → no saved preference to show */
    }
  }
  return Response.json({ time });
}

export async function POST(req: Request) {
  let body: { time?: string };
  try {
    body = (await req.json()) as { time?: string };
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const time = body.time;
  if (typeof time !== "string" || !TIME_RE.test(time)) {
    return Response.json({ error: "time must be HH:MM (24h)" }, { status: 400 });
  }

  const root = careerOpsRoot();
  const file = path.join(root, "config", "profile.yml");
  let base: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    // DATA-LOSS GUARD (mirrors /api/profile + /api/followups/cadence): a
    // profile that EXISTS but can't be parsed must never be silently replaced.
    let parsed: unknown;
    try {
      parsed = yaml.load(fs.readFileSync(file, "utf8"));
    } catch {
      return Response.json({ error: "config/profile.yml exists but could not be read as YAML — refusing to overwrite it." }, { status: 409 });
    }
    base = isObj(parsed) ? parsed : {};
  }

  const merged = { ...base, automation: { ...(isObj(base.automation) ? base.automation : {}), daily_scan_time: time } };
  try {
    atomicWriteWithBackup(file, yaml.dump(merged, { lineWidth: 100, noRefs: true }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "write failed" }, { status: 500 });
  }

  const [hh, mm] = time.split(":");
  const cron = `${Number(mm)} ${Number(hh)} * * *`;
  let queued = false;
  try {
    execFileSync(
      "node",
      [
        "agent-inbox.mjs",
        "add",
        `Apply daily-scan time change from Offerly Config: update scheduled task "career-ops-daily-scan" to cronExpression "${cron}" (${time} local time) via mcp__scheduled-tasks__update_scheduled_task.`,
      ],
      { cwd: root, stdio: ["ignore", "ignore", "ignore"] },
    );
    queued = true;
  } catch {
    // Preference is still saved even if the queue write failed (e.g. script
    // missing on an incomplete checkout) — surface it so the save isn't a
    // silent no-op the user has no way to know needs a manual nudge instead.
    queued = false;
  }

  return Response.json({ ok: true, time, queued });
}
