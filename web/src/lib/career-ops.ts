import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { atomicWrite } from "@/lib/core/safe-write";
import { parseApplications } from "@/lib/tracker-table.mjs";

/**
 * Resolve the career-ops "home" — the directory holding the user's sibling
 * files (cv.md, data/, reports/). In production the web/ app lives inside the
 * career-ops checkout, so the home is its parent (..). Dev overrides via
 * CAREER_OPS_ROOT to read the user's real (gitignored) data from a separate
 * checkout — see web/.env.local.
 */
export function careerOpsRoot(): string {
  const env = process.env.CAREER_OPS_ROOT?.trim();
  if (env) return env;
  return path.resolve(process.cwd(), "..");
}

/**
 * Absolute path to a core root script (e.g. doctor, verify-portals). The `.mjs`
 * is assembled here from the bare name so the literal never appears as a direct
 * `execFile`/`spawn` argument — Next's bundler statically traces such literals
 * as module imports and fails the production build otherwise.
 */
export function rootScript(nameNoExt: string): string {
  return path.join(careerOpsRoot(), `${nameNoExt}.mjs`);
}

// Feature-detect the core's `tracker.mjs delete --num` row-delete (#1200) by probing
// the local script source — older checkouts lack it, so the delete UI hides itself.
export function trackerCanDelete(): boolean {
  try {
    const src = fs.readFileSync(rootScript("tracker"), "utf8");
    return src.includes("delete") && src.includes("--num");
  } catch {
    return false;
  }
}

export type ProfileConfig = {
  tracks: Record<string, { label: string }>;
  weeklyTargets: { jobsAddedPerWeek: number; applyingDaysPerWeek: number } | null;
  /** `location.country` from config/profile.yml (e.g. "United States"), or
   *  null when unset — drives the pipeline inbox's default location facet. */
  country: string | null;
  /** Home ZIP used only for commute-distance display. */
  commuteZip: string | null;
  /** `location.max_commute_miles` — the user's hard cutoff for a non-remote
   *  commute. null when unset (no cutoff enforced). */
  maxCommuteMiles: number | null;
};

const PROFILE_DEFAULTS: ProfileConfig = { tracks: {}, weeklyTargets: null, country: null, commuteZip: null, maxCommuteMiles: null };

/**
 * Reads the `tracks:`, `weekly_targets:`, and `location.country` fields from
 * config/profile.yml (added 2026-08-13, see AGENTS.md's `track=` notes
 * convention). All are optional user-layer config — a profile.yml without
 * them (or missing entirely) degrades to defaults rather than erroring, same
 * "don't penalize missing data" discipline the core scanner filters use.
 */
export function readProfileConfig(): ProfileConfig {
  const raw = read("config/profile.yml");
  if (!raw) return PROFILE_DEFAULTS;
  try {
    const doc = yaml.load(raw) as Record<string, unknown>;
    const tracksRaw = (doc?.tracks ?? {}) as Record<string, { label?: string }>;
    const tracks: Record<string, { label: string }> = {};
    for (const [key, val] of Object.entries(tracksRaw)) {
      if (val && typeof val.label === "string") tracks[key] = { label: val.label };
    }
    const wt = doc?.weekly_targets as { jobs_added_per_week?: number; applying_days_per_week?: number } | undefined;
    const weeklyTargets =
      wt && typeof wt.jobs_added_per_week === "number" && typeof wt.applying_days_per_week === "number"
        ? { jobsAddedPerWeek: wt.jobs_added_per_week, applyingDaysPerWeek: wt.applying_days_per_week }
        : null;
    const loc = doc?.location as { country?: string; zip?: string | number; max_commute_miles?: number } | undefined;
    const country = typeof loc?.country === "string" && loc.country.trim() ? loc.country.trim() : null;
    const commuteZip = loc?.zip != null && String(loc.zip).trim() ? String(loc.zip).trim() : null;
    const maxCommuteMiles = typeof loc?.max_commute_miles === "number" && Number.isFinite(loc.max_commute_miles) ? loc.max_commute_miles : null;
    return { tracks, weeklyTargets, country, commuteZip, maxCommuteMiles };
  } catch {
    return PROFILE_DEFAULTS;
  }
}

function read(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(careerOpsRoot(), rel), "utf8");
  } catch {
    return null;
  }
}

/** Non-blocking sibling of read() for request-time Server Components: a
 *  genuinely slow or blocked data source (network mount, first-touch antivirus
 *  scan, an external drive that went to sleep) must never stall the RSC render
 *  on the event loop — callers race these against a bounded timeout and fall
 *  back to safe defaults. Parsing is shared with the sync readers via
 *  parseInbox/parseApplications/parseDismissedLeadUrls, so behavior can't drift. */
async function readAsync(rel: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(path.join(careerOpsRoot(), rel), "utf8");
  } catch {
    return null;
  }
}

export async function readInboxAsync(): Promise<InboxJob[]> {
  const [md, feedback] = await Promise.all([readAsync("data/pipeline.md"), readAsync("data/lead-feedback.jsonl")]);
  if (!md) return [];
  return parseInbox(md, parseDismissedLeadUrls(feedback), parseLocationExcludedCompanies(feedback));
}

export async function readApplicationsAsync(): Promise<Application[]> {
  const md = await readAsync("data/applications.md");
  if (!md) return [];
  return parseApplications(md, careerOpsRoot());
}

/** Like careerOpsRoot()+existsSync but non-blocking; false on any error. */
export async function careerOpsRootExistsAsync(): Promise<boolean> {
  try {
    await fs.promises.access(careerOpsRoot());
    return true;
  } catch {
    return false;
  }
}

/** URLs explicitly dismissed by the user. This is durable server-side state,
 * not merely a browser preference, so every surface can suppress the same job
 * before hydration instead of briefly rendering it again. */
function parseDismissedLeadUrls(raw: string | null): Set<string> {
  const urls = new Set<string>();
  if (!raw) return urls;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as { decision?: unknown; url?: unknown };
      if (entry.decision === "dismissed" && typeof entry.url === "string") urls.add(entry.url);
    } catch {
      // Append-only logs may contain a damaged trailing line after an interrupted
      // write. Keep the valid decisions instead of making the inbox unusable.
    }
  }
  return urls;
}

export function readDismissedLeadUrls(): Set<string> {
  return parseDismissedLeadUrls(read("data/lead-feedback.jsonl"));
}

const normCompany = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Companies passed on for a "location" reason (too far, not actually remote,
 *  on-site, relocation) — a location constraint is fixed per employer, not
 *  per posting, so this is the one pass category safe to generalize into a
 *  standing exclusion. Distinct from data/blacklist.md, which stays a
 *  strictly user-curated, never-auto-populated file (see its template) — this
 *  set is machine-derived from data/lead-feedback.jsonl, the same durable log
 *  readDismissedLeadUrls already reads. */
function parseLocationExcludedCompanies(raw: string | null): Set<string> {
  const companies = new Set<string>();
  if (!raw) return companies;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as { category?: unknown; company?: unknown };
      if (entry.category === "location" && typeof entry.company === "string" && entry.company.trim()) {
        companies.add(normCompany(entry.company));
      }
    } catch {
      /* see parseDismissedLeadUrls */
    }
  }
  return companies;
}

export function readLocationExcludedCompanies(): Set<string> {
  return parseLocationExcludedCompanies(read("data/lead-feedback.jsonl"));
}

export type InboxJob = { url: string; company: string; role: string; location?: string; compensation?: string; commuteMiles?: number; commuteApprox?: boolean; note?: string; done: boolean; postedAt?: string };

/** A pipeline-row segment like `posted: 2026-07-14`, `trust: 62 stale` or
 *  `note: …` — the core appends these LABELED segments after whatever
 *  positional shape a row has (3/4/5 columns), so a naive positional reader
 *  would misread them as location/compensation on short rows. Any
 *  `word:`-prefixed segment is treated as labeled (forward-compatible with
 *  labels the core hasn't invented yet). */
const LABELED_SEGMENT = /^([a-z][a-z_-]*):\s*(.*)$/i;

/** Parse data/pipeline.md — `- [ ] URL | Company | Role [| Location [| Compensation]] [| label: …]*`.
 *  Positional split for the first columns (the optional 4th `location` #1015
 *  and 5th `compensation` #1017 must NOT bleed into `role`); labeled segments
 *  (posted:/trust:/note:/…) are filtered out of positional assignment wherever
 *  they appear and surfaced when useful (posted: → postedAt). Unknown labels
 *  and further trailing columns are ignored gracefully. */
function parseInbox(md: string, dismissed: Set<string>, excludedCompanies: Set<string> = new Set()): InboxJob[] {
  const jobs: InboxJob[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/);
    if (!m) continue;
    const all = m[2].split("|").map((s) => s.trim());
    const labels = new Map<string, string>();
    const parts: string[] = [];
    for (const [i, seg] of all.entries()) {
      // the URL cell can contain a colon-y value but is always position 0
      const lm = i >= 3 ? seg.match(LABELED_SEGMENT) : null;
      if (lm) labels.set(lm[1].toLowerCase(), lm[2].trim());
      else parts.push(seg);
    }
    if (parts.length < 3 || !parts[0]) continue; // need at least url | company | role
    const posted = labels.get("posted");
    jobs.push({
      done: m[1].toLowerCase() === "x",
      url: parts[0],
      company: parts[1],
      role: parts[2],
      location: parts[3] || undefined, // optional 4th column (#1015)
      compensation: parts[4] || undefined, // optional 5th column (#1017); 6th+ ignored
      note: labels.get("note") || undefined,
      // the row's own posting date (scan.mjs `posted:` label) — a more direct
      // freshness signal than the scan-history join, which stays as fallback
      postedAt: posted && /^\d{4}-\d{2}-\d{2}$/.test(posted) ? posted : undefined,
    });
  }
  // Indeed's redirect links (to.indeed.com/...) mint a fresh URL for the same
  // real posting on every re-scrape, so URL-based done-tracking alone lets an
  // already-handled job reappear as a brand-new pending row under a new URL —
  // "I've gone through these before, they keep showing up." Backfill: once ANY
  // row for a given company+title has been checked off, treat every row that
  // shares it as done too, regardless of which URL each was scraped under.
  const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const handled = new Set(jobs.filter((j) => j.done).map((j) => `${normKey(j.company)}|${normKey(j.role)}`));
  for (const job of jobs) {
    if (!job.done && handled.has(`${normKey(job.company)}|${normKey(job.role)}`)) job.done = true;
  }
  return jobs.filter((job) => !dismissed.has(job.url) && !excludedCompanies.has(normCompany(job.company)));
}

export function readInbox(): InboxJob[] {
  const md = read("data/pipeline.md");
  if (!md) return [];
  return parseInbox(md, readDismissedLeadUrls(), readLocationExcludedCompanies());
}

/** Read an intake note referenced by a pipeline row. The reference must stay
 * inside jds/ after symlink resolution; arbitrary note text can never become a
 * filesystem read. */
export function readInboxIntake(job: InboxJob | null): string | null {
  const ref = job?.note?.match(/(?:^|\s)intake:\s*(jds\/[A-Za-z0-9._-]+\.md)(?:\s|$)/i)?.[1];
  if (!ref) return null;
  const root = careerOpsRoot();
  const file = path.join(root, ref);
  if (!containedRealpath(file, path.join(root, "jds"))) return null;
  try { return fs.readFileSync(file, "utf8"); } catch { return null; }
}

/**
 * Read data/scan-history.tsv → Map<url, first_seen(YYYY-MM-DD)>. The scanner
 * already stamps every discovered posting with the date it was first seen
 * (col 2), so we derive the inbox's freshness signal here WITHOUT touching the
 * core (see the inbox-triage build: freshness = option A, no scanner change).
 * Tolerant by construction: no file → empty map (freshness facet just hides);
 * a malformed row is skipped, never thrown (missing ≠ corrupt).
 */
export function readScanDates(): Map<string, string> {
  const tsv = read("data/scan-history.tsv");
  const dates = new Map<string, string>();
  if (!tsv) return dates;
  const lines = tsv.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || (i === 0 && line.startsWith("url\t"))) continue; // skip header
    const tab = line.indexOf("\t");
    if (tab < 1) continue;
    const url = line.slice(0, tab);
    const firstSeen = line.slice(tab + 1).split("\t")[0]?.trim();
    // keep the EARLIEST first_seen if a url recurs (it's "first" seen, after all)
    if (/^\d{4}-\d{2}-\d{2}$/.test(firstSeen) && !dates.has(url)) dates.set(url, firstSeen);
  }
  return dates;
}

export type Application = {
  n: string;
  date: string;
  company: string;
  /** Intermediary channel (#1596): agency/recruiter firm, "—" for direct, "" when the tracker has no Via column. */
  via: string;
  role: string;
  score: string;
  status: string;
  pdf: string;
  report: string;
  notes: string;
};

/**
 * Parse data/applications.md — the tracker table (source of truth).
 * The header-aware parsing lives in tracker-table.mjs, which resolves headers
 * through the SAME alias table the Node tooling uses (tracker-aliases.json,
 * exported by tracker-parse.mjs as HEADER_ALIASES) — one shared source, no
 * web-side mirror to drift (#954, PR #1598 review).
 */
export function readApplications(): Application[] {
  const md = read("data/applications.md");
  if (!md) return [];
  return parseApplications(md, careerOpsRoot());
}

export type Contact = { name: string; company: string; type: string; title: string; phone: string; email: string; linkedin: string; tracker: string | null; notes: string };

/** Reads the canonical contact store. It is user-layer PII and is never copied
 * into a database or an application report. */
export function readContacts(): Contact[] {
  const contacts: Contact[] = [];
  for (const raw of (read("data/contacts.tsv") || "").split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const cells = raw.replace(/\r$/, "").split("\t").map((cell) => cell.trim());
    if (cells.length < 4 || !cells[0] || !cells[1]) continue;
    const [name, company, type, title, phone = "", email = "", linkedin = "", tracker = "", ...notes] = cells;
    contacts.push({ name, company, type, title, phone, email, linkedin, tracker: tracker === "-" ? null : tracker || null, notes: notes.join(" ") });
  }
  return contacts;
}

/**
 * Server-side lifecycle of the user's setup — mirrors the prerequisite list that
 * doctor.mjs uses (cv.md, config/profile.yml, modes/_profile.md, portals.yml), by
 * plain file-stat (no subprocess). Drives the home branch: first-run (no CV) →
 * the CV takeover; in-between (CV but no profile) → gentle nudges; established.
 */
export type LifecyclePhase = "first-run" | "in-between" | "established";
/**
 * Server-side lifecycle, mirroring the core doctor.mjs prerequisite list with the
 * SAME existsSync semantics (the SSOT the OnboardingBanner already reads via
 * /api/doctor). The 4 user-layer prereqs: cv.md, config/profile.yml,
 * modes/_profile.md, portals.yml.
 *   - first-run  → a TRULY empty install (no cv AND no data): the CV takeover.
 *     CRITICAL back-compat (maintainer): NEVER force onboarding on a user who
 *     already has data (a full pipeline/tracker with no cv.md is valid).
 *   - in-between → has cv/data but setup incomplete: dashboard + the nudge banner.
 *   - established → all 4 prereqs present.
 * onboardingNeeded mirrors doctor.mjs: true if ANY prereq is missing → show banner.
 */
export function doctorState(): {
  phase: LifecyclePhase;
  onboardingNeeded: boolean;
  missing: string[];
  hasCv: boolean;
  hasData: boolean;
} {
  const has = (rel: string) => {
    try {
      return fs.existsSync(path.join(careerOpsRoot(), rel));
    } catch {
      return false;
    }
  };
  const prereqs: [string, string][] = [
    ["cv.md", "cv.md"],
    ["config/profile.yml", "config/profile.yml"],
    ["modes/_profile.md", "modes/_profile.md"],
    ["portals.yml", "portals.yml"],
  ];
  const missing = prereqs.filter(([rel]) => !has(rel)).map(([, label]) => label);
  const hasCv = has("cv.md");
  const hasData = readApplications().length > 0 || readInbox().some((j) => !j.done);
  const onboardingNeeded = missing.length > 0;
  const phase: LifecyclePhase = !hasCv && !hasData ? "first-run" : onboardingNeeded ? "in-between" : "established";
  return { phase, onboardingNeeded, missing, hasCv, hasData };
}

export type PipelineSummary = {
  root: string;
  rootExists: boolean;
  inbox: InboxJob[];
  applications: Application[];
};

export function pipelineSummary(): PipelineSummary {
  const root = careerOpsRoot();
  const scanDates = readScanDates();
  return {
    root,
    rootExists: fs.existsSync(root),
    // join the freshness date (first_seen) onto each raw posting — the inbox's
    // triage view orders/faceted-filters on it entirely client-side.
    inbox: readInbox().map((j) => ({ ...j, postedAt: j.postedAt ?? scanDates.get(j.url) })),
    applications: readApplications(),
  };
}

export type ReportData = { content: string; file: string };

/** Locate the evaluation report for an application number.
 *  The tracker row's own report link is authoritative: report FILE numbers can
 *  differ from application numbers (e.g. app #309 → reports/308-…), so
 *  resolving only by leading filename number misses those. Links are
 *  normalized relative to the tracker file's directory (see #760). Falls back
 *  to the filename scan (reports/{n}-{slug}-{date}.md, possibly zero-padded)
 *  for rows without a parseable link. */
export function findReportFile(n: string): string | null {
  const target = parseInt(n, 10);
  if (Number.isNaN(target)) return null;
  const root = careerOpsRoot();
  const app = readApplications().find((a) => parseInt(a.n, 10) === target);
  const linked = app?.report.match(/\]\(([^)]+)\)/)?.[1];
  if (linked) {
    const p = path.resolve(root, "data", linked);
    // Containment: a hand-edited link must not resolve outside the project.
    if (p.endsWith(".md") && containedRealpath(p, root)) return p;
  }
  let files: string[];
  try {
    files = fs.readdirSync(path.join(root, "reports"));
  } catch {
    return null;
  }
  // Reservation sentinels contain allocator metadata (pid/token), not report
  // prose. They occupy a number but must never be rendered as its report.
  const match = files.find((f) => f.endsWith(".md") && !/-RESERVED\.md$/i.test(f) && parseInt(f, 10) === target);
  if (!match) return null;
  const p = path.join(root, "reports", match);
  return containedRealpath(p, root) ? p : null;
}

/** Recover the original posting URL for summary-only tracker rows. Daily-scan
 * batches can create a scored tracker row without a full report/link; their
 * source URL remains in scan-history.tsv. Exact company+role matching avoids
 * guessing between similarly named openings. */
// Strip parenthetical asides and non-alphanumerics so "Sr Manager... (Medical
// Affairs)" and "Senior Manager..." tokenize close enough to compare.
const roleTokens = (s: string): string[] =>
  s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

/** Fraction of the shorter token set found in the longer one — cheap
 *  word-overlap similarity, not edit distance, but enough to survive an
 *  LLM's paraphrase ("Sr" / "Ops") of a title it re-typed into the tracker
 *  from the raw scan text. */
function roleSimilarity(a: string, b: string): number {
  const ta = new Set(roleTokens(a));
  const tb = new Set(roleTokens(b));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

export function findApplicationSourceUrl(app: Application | null): string | null {
  if (!app) return null;
  const tsv = read("data/scan-history.tsv");
  if (!tsv) return null;
  const company = app.company.trim().toLowerCase();
  const role = app.role.trim();
  let exact: string | null = null;
  let best: { url: string; score: number } | null = null;
  for (const line of tsv.split("\n")) {
    const cols = line.split("\t");
    if (cols.length < 6) continue;
    const [url, , , rowRole, rowCompany, status] = cols;
    if (!/^https?:\/\//i.test(url) || rowCompany?.trim().toLowerCase() !== company || !status?.startsWith("added")) continue;
    if (rowRole?.trim().toLowerCase() === role.toLowerCase()) {
      exact = url;
      continue;
    }
    // A same-company posting whose title merely reads differently (title-
    // case, "Sr" vs "Senior", a trailing team/department in parens) — the
    // exact-match path above still wins when it's available; this is the
    // fallback for the far more common case where the tracker's role text
    // was re-typed/paraphrased by an LLM rather than copied verbatim.
    const score = roleSimilarity(role, rowRole ?? "");
    if (score >= 0.5 && (!best || score > best.score)) best = { url, score };
  }
  return exact ?? best?.url ?? null;
}

/** True containment check: resolves symlinks before comparing, so a link
 *  planted under data/ or reports/ can't leak files outside the project. */
function containedRealpath(p: string, root: string): boolean {
  try {
    return fs.realpathSync(p).startsWith(fs.realpathSync(root) + path.sep);
  } catch {
    return false; // missing file or unresolvable link — treat as not found
  }
}

export function readReport(n: string): ReportData | null {
  const file = findReportFile(n);
  if (!file) return null;
  try {
    return { content: fs.readFileSync(file, "utf8"), file: path.basename(file) };
  } catch {
    return null;
  }
}

export function findApplication(n: string): Application | null {
  return readApplications().find((a) => a.n === n) ?? null;
}

/** The CANONICAL user-customization file the CLI/TUI reads. Durable facts the
 *  web assistant learns go HERE (single source of truth) inside a managed marker
 *  block — so the CLI sees them too. No web-only memory store (that would drift). */
export function profilePath(): string {
  return path.join(careerOpsRoot(), "modes", "_profile.md");
}

const NOTES_START = "<!-- co-web-notes:start -->";
const NOTES_END = "<!-- co-web-notes:end -->";

/** Read back ONLY the web-assistant managed notes from modes/_profile.md (small,
 *  focused — the agent reads the rest of the canonical files itself). Falls back
 *  to the legacy web-only memory file for back-compat. */
export function readMemory(): string {
  try {
    const md = fs.readFileSync(profilePath(), "utf8");
    const i = md.indexOf(NOTES_START);
    const j = md.indexOf(NOTES_END);
    if (i !== -1 && j !== -1 && j > i) return md.slice(i + NOTES_START.length, j).trim();
  } catch {
    /* no _profile.md yet */
  }
  try {
    return fs.readFileSync(path.join(careerOpsRoot(), ".career-ops-web", "memory.md"), "utf8").trim();
  } catch {
    return "";
  }
}

/** Append a durable fact to the canonical modes/_profile.md (creating the file +
 *  managed block if needed), PRESERVING existing user content. */
export function rememberFact(fact: string): "ok" | "deduped" | "error" {
  const f = fact.trim().replace(/\s+/g, " ").slice(0, 300);
  if (!f) return "deduped";
  const p = profilePath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    let md = "";
    try {
      md = fs.readFileSync(p, "utf8");
    } catch {
      md = "";
    }
    const i = md.indexOf(NOTES_START);
    const j = md.indexOf(NOTES_END);
    if (i !== -1 && j !== -1 && j > i) {
      if (md.slice(i, j).includes(f)) return "deduped";
      atomicWrite(p, md.slice(0, j) + `- ${f}\n` + md.slice(j));
      return "ok";
    }
    if (md.includes(f)) return "deduped";
    const section = `\n\n## Notes from the web assistant\n${NOTES_START}\n- ${f}\n${NOTES_END}\n`;
    const base = md.trim() ? md.replace(/\n*$/, "\n") : "# Profile customization\n";
    atomicWrite(p, base + section);
    return "ok";
  } catch {
    return "error";
  }
}
