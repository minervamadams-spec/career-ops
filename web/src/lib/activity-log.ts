import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";

export const ACTIVITY_RETENTION_MS = 72 * 60 * 60 * 1000;
const MAX_LABEL_LENGTH = 100;

export type ActivityEvent = {
  at: string;
  kind: "navigation" | "click" | "api" | "error";
  path: string;
  label?: string;
  status?: number;
};

export function activityLogPath(): string {
  return path.join(careerOpsRoot(), "data", "tool-activity.jsonl");
}

export function activityWindowPath(): string {
  return path.join(careerOpsRoot(), "data", "tool-activity-window.json");
}

export function sanitizeActivityEvent(input: unknown, now = Date.now()): ActivityEvent | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (!(["navigation", "click", "api", "error"] as const).includes(raw.kind as ActivityEvent["kind"])) return null;
  if (typeof raw.path !== "string" || !raw.path.startsWith("/") || raw.path.length > 200) return null;

  const event: ActivityEvent = {
    at: new Date(now).toISOString(),
    kind: raw.kind as ActivityEvent["kind"],
    // Never retain query strings or fragments; they can contain job/company data.
    path: raw.path.split(/[?#]/, 1)[0],
  };
  if (typeof raw.label === "string") {
    const label = raw.label.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_LENGTH);
    if (label) event.label = label;
  }
  if (typeof raw.status === "number" && Number.isInteger(raw.status) && raw.status >= 100 && raw.status <= 599) {
    event.status = raw.status;
  }
  return event;
}

export function appendActivity(event: ActivityEvent, now = Date.now()): boolean {
  const file = activityLogPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const windowFile = activityWindowPath();
  let expiresAt = now + ACTIVITY_RETENTION_MS;
  try {
    const saved = JSON.parse(fs.readFileSync(windowFile, "utf8")) as { expiresAt?: string };
    const parsed = Date.parse(saved.expiresAt || "");
    if (Number.isFinite(parsed)) expiresAt = parsed;
  } catch {
    atomicWrite(windowFile, `${JSON.stringify({ startedAt: new Date(now).toISOString(), expiresAt: new Date(expiresAt).toISOString() }, null, 2)}\n`);
  }
  // This is a fixed diagnostic window, not permanent rolling telemetry.
  if (now >= expiresAt) return false;
  const cutoff = now - ACTIVITY_RETENTION_MS;
  let retained: string[] = [];
  try {
    retained = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .filter((line) => {
        try {
          const at = Date.parse((JSON.parse(line) as { at?: string }).at || "");
          return Number.isFinite(at) && at >= cutoff;
        } catch {
          return false;
        }
      });
  } catch {
    // First event creates the file.
  }
  retained.push(JSON.stringify(event));
  atomicWrite(file, `${retained.join("\n")}\n`);
  return true;
}
