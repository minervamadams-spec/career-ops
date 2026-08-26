import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

test("every raw-job card surface uses the canonical signals contract", () => {
  for (const rel of ["src/components/explore/discovery-card.tsx", "src/components/inbox/triage-row.tsx"]) {
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
