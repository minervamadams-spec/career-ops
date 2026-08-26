import { deriveCompanySeeds, isNearDuplicate } from '../seed-tracked-companies.mjs';

let failures = 0;
function assert(ok, message) { if (!ok) { failures++; console.error(`FAIL: ${message}`); } }
const tracker = `# Applications\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n| 1 | 2026-08-26 | Isolatek International | Operations Manager | 4.2/5 | Evaluated | ❌ | — | — |\n| 2 | 2026-08-26 | Acme LLC | Product Manager | — | Applied | ❌ | — | — |\n| 3 | 2026-08-26 | Low Fit | Other | 3.0/5 | Evaluated | ❌ | — | — |\n`;
const result = deriveCompanySeeds(tracker, [{ name: 'ISOLATEK International' }]);
assert(result.length === 1 && result[0] === 'Acme LLC', 'includes score>=4 or Applied, excludes lower-score rows and tracked casing duplicate');
assert(deriveCompanySeeds(tracker + '| 4 | 2026-08-26 | Acme Group | Program Manager | 4.1/5 | Evaluated | ❌ | — | — |\n', []).filter(n => /Acme/i.test(n)).length === 1, 'deduplicates tracker-side suffix variants');
assert(isNearDuplicate('Weiss-Aug Group', 'Weiss-Aug'), 'recognizes near duplicate company variants');
if (failures) process.exitCode = 1;
else console.log('seed-tracked-companies tests OK');
