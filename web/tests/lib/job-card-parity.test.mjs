import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

test("every raw-job card surface uses the canonical signals contract", () => {
  // Was a two-surface parity check (discovery-card.tsx + inbox/triage-row.tsx).
  // triage-row.tsx and its parent inbox-triage.tsx were removed 2026-09-22
  // along with the standalone Pipeline list page (Minerva: "this page should
  // go away") — DiscoveryCard (Today's "Fresh matches" + Explore) is now the
  // only raw-job card surface, so there's nothing left to keep in parity with.
  for (const rel of ["src/components/explore/discovery-card.tsx"]) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(source, /JobCardSignals/, `${rel} must render canonical job-card signals`);
    assert.match(source, /Dismiss/, `${rel} must keep a labeled dismiss action`);
  }
});

test("the canonical signals contract retains decision-critical fields", () => {
  const source = fs.readFileSync(path.join(root, "src/components/job-card-signals.tsx"), "utf8");
  for (const field of ["location", "compensation", "commuteMiles", "commuteApprox", "sourceLabel", "ageLabel"]) {
    assert.match(source, new RegExp(`\\b${field}\\b`), `missing ${field}`);
  }
  for (const label of ["Remote", "Hybrid", "On-site", "mi commute"]) assert.match(source, new RegExp(label));
});
