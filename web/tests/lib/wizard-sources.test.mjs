import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("wizard describes Indeed as a manual review link", () => {
  const review = read("src/components/wizard/wizard-review-step.tsx");
  assert.doesNotMatch(review, /search_jobs tool|Indeed search \(~\$\{/);
  assert.match(review, /Indeed human-review link/);
  assert.match(review, /Do not run an automated Indeed scraper or paid actor/);
});

test("wizard company saves expose failed responses and only advance with saved companies", () => {
  const source = read("src/components/wizard/wizard-sources-step.tsx");
  const helper = read("src/lib/wizard-company-save.ts");
  assert.match(helper, /if \(response\.ok\) saved\.push\(company\)/);
  assert.match(helper, /else failed\.push\(company\)/);
  assert.match(source, /if \(companyResult\.failed\.length\)/);
  assert.match(source, /setError\(`Couldn’t save \$\{names\}/);
  assert.match(source, /companies: companyResult\.saved/);
  assert.doesNotMatch(source, /\.catch\(\(\) => \{\}\)/);
});
