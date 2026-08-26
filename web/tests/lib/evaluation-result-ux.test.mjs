import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("completed evaluations link directly to their useful Pipeline report", () => {
  const route = read("src/app/api/run/route.ts");
  const store = read("src/components/jobs/job-store.tsx");
  const page = read("src/app/jobs/[id]/page.tsx");
  assert.match(route, /type: "artifact", reportId/);
  assert.match(route, /reason = reportText/);
  assert.match(store, /reportId\?: string/);
  assert.match(page, /View evaluation/);
  assert.match(page, /Pipeline is Offerly&apos;s application tracker/);
});

test("full evaluation is disclosed before the user starts it", () => {
  const actions = read("src/components/inbox/prospect-actions.tsx");
  const quickEvaluate = read("src/components/quick-evaluate.tsx");
  assert.match(actions, /Full evaluation/);
  assert.match(actions, /2–5 min/);
  assert.match(quickEvaluate, /Full evaluation/);
  assert.match(quickEvaluate, /2–5 min/);
});

test("implementation chatter is secondary on the result page", () => {
  const page = read("src/app/jobs/[id]/page.tsx");
  assert.match(page, /<details className="group mt-6/);
  assert.match(page, /Technical activity/);
  assert.match(page, /Worker transcript/);
});
