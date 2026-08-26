import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("global client reads use the shared request cache", () => {
  const files = [
    "src/components/usage-meter.tsx",
    "src/components/home/today-dashboard.tsx",
    "src/components/beta/beta-banner.tsx",
    "src/components/explore/explore-provider.tsx",
  ];
  for (const file of files) assert.match(read(file), /cachedJson</, `${file} bypasses shared cache`);
  assert.match(read("src/lib/client-query.ts"), /current\?\.promise/);
});

test("list logos are coalesced through the batch route", () => {
  assert.match(read("src/lib/logo-client.ts"), /method: "POST"/);
  assert.match(read("src/lib/logo-client.ts"), /setTimeout\(\(\) => void flush\(\), 20\)/);
  assert.match(read("src/app/api/logo/route.ts"), /export async function POST/);
  assert.match(read("src/components/company-logo.tsx"), /useBatchedLogo/);
  assert.match(read("src/components/explore/discovery-card.tsx"), /useBatchedLogo/);
});

test("explore page reads data async with a bounded budget and safe defaults", () => {
  const source = read("src/app/explore/page.tsx");
  // Data reads must be non-blocking (fs.promises path) and raced against a hard
  // time budget, so a sick data root degrades to safe defaults in bounded time
  // instead of stalling the RSC stream (2026-08-19 explore-navigation review).
  assert.match(source, /readInboxAsync\(\)/, "readInboxAsync() is not used");
  assert.match(source, /readApplicationsAsync\(\)/, "readApplicationsAsync() is not used");
  assert.match(source, /Promise\.race/, "reads are not raced against a timeout");
  assert.match(source, /READ_BUDGET_MS\s*=\s*[\d_]+/, "missing bounded read budget");
  assert.match(source, /catch\s*\{[^}]*safe default/s, "missing safe-default catch comment");
  // The route must also paint an instant shell while the async page streams in.
  const loading = read("src/app/explore/loading.tsx");
  assert.match(loading, /aria-busy="true"/, "loading.tsx shell missing");
  const lib = read("src/lib/career-ops.ts");
  assert.match(lib, /fs\.promises\.readFile/, "async readers must use fs.promises (non-blocking)");
  assert.match(lib, /export async function readInboxAsync/, "missing readInboxAsync export");
  assert.match(lib, /export async function readApplicationsAsync/, "missing readApplicationsAsync export");
});

test("dev server purges foreign service workers that wedge client navigation", () => {
  // Root cause of the 2026-08-19 "Find new roles hangs forever" bug: a stale SW
  // from another product on the same localhost origin intercepted RSC requests.
  // The AppShell must keep the dev-only unregister guard (and it must stay
  // dev-only so a future production SW of our own is never purged).
  const source = read("src/components/app-shell.tsx");
  assert.match(source, /serviceWorker" in navigator/, "missing serviceWorker feature check");
  assert.match(source, /getRegistrations\(\)/, "missing getRegistrations() probe");
  assert.match(source, /\.unregister\(\)/, "missing unregister() call");
  assert.match(source, /NODE_ENV === "production"/, "guard must be dev-only (early-returns in production)");
  // The reload is bounded to at most once per tab session by a ref (Strict Mode
  // double-fire) AND a sessionStorage flag (survives the guard's own reload) —
  // an unbounded reload here cancels in-flight route transitions (review finding).
  assert.match(source, /useRef\(false\)/, "missing Strict Mode double-fire ref guard");
  assert.match(source, /sessionStorage\.getItem\(FLAG\)/, "missing once-per-tab-session flag check");
  assert.match(source, /sessionStorage\.setItem\(FLAG, "1"\)/, "missing once-per-tab-session flag set");
});

test("career-ops data loaders return safe defaults for missing/bad root", async () => {
  const { execSync } = await import("node:child_process");
  const script = `
    process.env.CAREER_OPS_ROOT = "/nonexistent/career-ops-root-" + Date.now();
    const { readInbox, readApplications, readScanDates, readDismissedLeadUrls } = require("${path.join(root, "src/lib/career-ops.ts").replace(/\\/g, "\\\\")}");
    const inbox = readInbox();
    const apps = readApplications();
    const dates = readScanDates();
    const dismissed = readDismissedLeadUrls();
    console.log(JSON.stringify({
      inboxIsArray: Array.isArray(inbox),
      inboxLength: inbox.length,
      appsIsArray: Array.isArray(apps),
      appsLength: apps.length,
      datesIsMap: dates instanceof Map,
      datesSize: dates.size,
      dismissedIsSet: dismissed instanceof Set,
      dismissedSize: dismissed.size,
    }));
  `;
  const out = execSync(`npx tsx -e '${script}'`, { encoding: "utf8", cwd: root });
  const result = JSON.parse(out.trim());
  assert.equal(result.inboxIsArray, true, "readInbox() must return an array for missing root");
  assert.equal(result.inboxLength, 0, "readInbox() must return empty array for missing root");
  assert.equal(result.appsIsArray, true, "readApplications() must return an array for missing root");
  assert.equal(result.appsLength, 0, "readApplications() must return empty array for missing root");
  assert.equal(result.datesIsMap, true, "readScanDates() must return a Map for missing root");
  assert.equal(result.datesSize, 0, "readScanDates() must return empty Map for missing root");
  assert.equal(result.dismissedIsSet, true, "readDismissedLeadUrls() must return a Set for missing root");
  assert.equal(result.dismissedSize, 0, "readDismissedLeadUrls() must return empty Set for missing root");
});

test("career-ops data loaders survive corrupted data files without hanging or throwing", async () => {
  const { execSync } = await import("node:child_process");
  const script = `
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-ops-corrupt-"));
    fs.mkdirSync(path.join(rootDir, "data"), { recursive: true });
    // Garbage that partially matches the row shapes: short rows, stray labels,
    // a damaged trailing JSONL line, malformed TSV rows — none may throw.
    fs.writeFileSync(path.join(rootDir, "data", "pipeline.md"), [
      "- [ ] https://example.com/job | OnlyCompany",
      "- [x] not-a-url",
      "- [ ]  |  | ",
      "garbage line without checkbox",
      "- [ ] https://example.com/a | Acme | Engineer | remote: yes | posted: not-a-date",
      "",
    ].join("\\n"));
    fs.writeFileSync(path.join(rootDir, "data", "applications.md"), "# not a table at all\\n\\n| broken\\n| --- | --- |\\n| 1 |\\n");
    const validLead = JSON.stringify({ decision: "dismissed", url: "https://example.com/x" });
    fs.writeFileSync(path.join(rootDir, "data", "lead-feedback.jsonl"), validLead + "\\n" + validLead.slice(0, 20));
    fs.writeFileSync(path.join(rootDir, "data", "scan-history.tsv"), "url\\tfirst_seen\\n\\t\\nno-tab-here\\nhttps://example.com/a\\t2026-13-99\\n");
    process.env.CAREER_OPS_ROOT = rootDir;
    const { readInbox, readApplications, readScanDates, readDismissedLeadUrls } = require("${path.join(root, "src/lib/career-ops.ts").replace(/\\/g, "\\\\")}");
    const started = Date.now();
    const inbox = readInbox();
    const apps = readApplications();
    const dates = readScanDates();
    const dismissed = readDismissedLeadUrls();
    console.log(JSON.stringify({
      elapsedMs: Date.now() - started,
      inboxIsArray: Array.isArray(inbox),
      appsIsArray: Array.isArray(apps),
      datesIsMap: dates instanceof Map,
      dismissedIsSet: dismissed instanceof Set,
      dismissedSize: dismissed.size,
    }));
    fs.rmSync(rootDir, { recursive: true, force: true });
  `;
  const out = execSync(`npx tsx -e '${script}'`, { encoding: "utf8", cwd: root, timeout: 30_000 });
  const result = JSON.parse(out.trim());
  assert.equal(result.inboxIsArray, true, "readInbox() must return an array for corrupted pipeline.md");
  assert.equal(result.appsIsArray, true, "readApplications() must return an array for corrupted applications.md");
  assert.equal(result.datesIsMap, true, "readScanDates() must return a Map for corrupted scan-history.tsv");
  assert.equal(result.dismissedIsSet, true, "readDismissedLeadUrls() must return a Set for corrupted lead-feedback.jsonl");
  assert.equal(result.dismissedSize, 1, "the valid line before the damaged one must be kept");
  assert.ok(result.elapsedMs < 5000, `corrupted data must resolve fast, took ${result.elapsedMs}ms`);
});
