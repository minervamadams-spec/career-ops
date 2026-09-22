import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";

/**
 * ACL for templates/skip-reasons.yml — the SINGLE SOURCE OF TRUTH for the
 * structured self-filter reason taxonomy (career-ops writer CLI + this app
 * both read it live), mirroring states.ts's relationship to states.yml. The
 * FALLBACK below is a last resort if the file is unreadable and is kept
 * identical to the file.
 */
export type SkipReason = {
  id: string;
  label: string;
};

const FALLBACK: SkipReason[] = [
  { id: "not_my_domain", label: "Not my domain" },
  { id: "location_or_remote_restricted", label: "Location/remote restricted" },
  { id: "expired_listing", label: "Expired listing" },
  { id: "unwanted_part_time_or_fractional", label: "Unwanted part-time/fractional" },
  { id: "duplicate_of_existing", label: "Duplicate of existing application" },
  { id: "not_qualified", label: "Not qualified" },
  { id: "travel_required", label: "Travel required" },
  { id: "comp_too_low", label: "Comp too low" },
  { id: "wrong_seniority", label: "Wrong seniority" },
  { id: "undesired_shift_or_schedule", label: "Undesired shift/schedule" },
  { id: "skill_or_background_mismatch", label: "Skill/background mismatch" },
];

let cache: SkipReason[] | null = null;

export function readSkipReasons(): SkipReason[] {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(path.join(careerOpsRoot(), "templates", "skip-reasons.yml"), "utf8");
    const doc = yaml.load(raw) as { reasons?: unknown };
    const list = Array.isArray(doc?.reasons) ? doc.reasons : null;
    if (list && list.length) {
      const parsed: SkipReason[] = [];
      for (const r of list as Record<string, unknown>[]) {
        if (!r || typeof r.id !== "string" || typeof r.label !== "string") continue;
        parsed.push({ id: r.id, label: r.label });
      }
      if (parsed.length) {
        cache = parsed;
        return parsed;
      }
    }
  } catch {
    /* fall through to fallback */
  }
  cache = FALLBACK;
  return FALLBACK;
}

/** Resolve raw input (id or label, case-insensitive) to a canonical reason id, or null. */
export function resolveSkipReasonId(raw: string): string | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  for (const r of readSkipReasons()) {
    if (r.id.toLowerCase() === q || r.label.toLowerCase() === q) return r.id;
  }
  return null;
}

export function skipReasonLabel(id: string): string | null {
  return readSkipReasons().find((r) => r.id === id)?.label ?? null;
}
