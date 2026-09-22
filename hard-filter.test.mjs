/**
 * hard-filter.test.mjs — tests for the hard_filters enforcement, repost gate,
 * and skip-reason taxonomy added by the career-ops offerly scoring brief
 * (2026-09-22).
 *
 * Covers:
 * - buildHardFilter (scan.mjs): titles_excluded, shifts_excluded, travel_max_pct,
 *   excluded_role_types, known_large_companies + large_company_titles_excluded
 *   combo, local_government_exempt_keywords, track_b_hourly_rate_min, overrides.
 * - buildRepostGate (scan.mjs): decided-against tier, scanned tier, no false
 *   positives across companies/roles.
 * - loadSkipReasons / resolveSkipReason (tracker-utils.mjs): taxonomy loading
 *   and id/label resolution against the real templates/skip-reasons.yml.
 *
 * Run: node hard-filter.test.mjs
 */

import { buildHardFilter, buildRepostGate, loadHardFilters } from './scan.mjs';
import { loadSkipReasons, resolveSkipReason } from './tracker-utils.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const CAREER_OPS = dirname(fileURLToPath(import.meta.url));
const SKIP_REASONS_FILE = join(CAREER_OPS, 'templates/skip-reasons.yml');

let passed = 0;
let failed = 0;
const failures = [];

function ok(label, cond) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}

// ============================================================================
// buildHardFilter
// ============================================================================
console.log('buildHardFilter');

{
  const hf = () => ({ pass: true });
  ok('no hard_filters config never filters', buildHardFilter(null)({ title: 'VP of Anything' }).pass === true);
  ok('non-object hard_filters never filters', buildHardFilter('nonsense')({ title: 'VP' }).pass === true);
}

{
  const hardFilter = buildHardFilter({ titles_excluded: ['VP', 'Head of'] });
  ok('titles_excluded rejects a matching title', buildHardFilter({ titles_excluded: ['VP'] })({ title: 'VP of Product', description: '', company: 'Acme' }).pass === false);
  ok('titles_excluded reason is title_excluded', buildHardFilter({ titles_excluded: ['VP'] })({ title: 'VP of Product', description: '', company: 'Acme' }).reason === 'title_excluded');
  ok('titles_excluded passes a non-matching title', hardFilter({ title: 'Product Manager', description: '', company: 'Acme' }).pass === true);
}

{
  const hardFilter = buildHardFilter({ shifts_excluded: ['Night shift'] });
  ok('shifts_excluded rejects a matching description', hardFilter({ title: 'Ops', description: 'Requires night shift coverage.', company: 'Acme' }).pass === false);
  ok('shifts_excluded passes when absent from description', hardFilter({ title: 'Ops', description: 'Standard business hours.', company: 'Acme' }).pass === true);
}

{
  const hardFilter = buildHardFilter({ travel_max_pct: 5 });
  ok('travel_max_pct rejects a higher stated percentage', hardFilter({ title: 'PM', description: 'Requires up to 25% travel.', company: 'Acme' }).pass === false);
  ok('travel_max_pct passes a lower stated percentage', hardFilter({ title: 'PM', description: 'Requires up to 2% travel.', company: 'Acme' }).pass === true);
  ok('travel_max_pct passes when no percentage is stated', hardFilter({ title: 'PM', description: 'Some travel may be required.', company: 'Acme' }).pass === true);
}

{
  const hardFilter = buildHardFilter({ excluded_role_types: ['Data annotator', 'AI data labeling'] });
  ok('excluded_role_types matches title', hardFilter({ title: 'Data Annotator', description: '', company: 'DataAnnotation' }).pass === false);
  ok('excluded_role_types matches description', hardFilter({ title: 'Contractor', description: 'AI data labeling work from home.', company: 'Acme' }).pass === false);
  ok('excluded_role_types passes unrelated roles', hardFilter({ title: 'Product Manager', description: 'Own the roadmap.', company: 'Acme' }).pass === true);
}

{
  const hardFilter = buildHardFilter({
    known_large_companies: ['Regeneron'],
    large_company_titles_excluded: ['Director'],
    local_government_exempt_keywords: ['County'],
  });
  ok('large company + senior title combo is rejected', hardFilter({ title: 'Senior Director, Ops', description: '', company: 'Regeneron' }).pass === false);
  ok('large company + senior title reason', hardFilter({ title: 'Senior Director, Ops', description: '', company: 'Regeneron' }).reason === 'large_company_senior_title');
  ok('large company alone (no matching title) passes', hardFilter({ title: 'Product Manager', description: '', company: 'Regeneron' }).pass === true);
  ok('small company with senior title passes (not in known_large_companies)', hardFilter({ title: 'Senior Director, Ops', description: '', company: 'Small Co' }).pass === true);
  ok('local-government exemption waives the large-company gate', hardFilter({ title: 'Director of Regeneron County Services', description: '', company: 'Regeneron County' }).pass === true);
}

{
  const hardFilter = buildHardFilter({ track_b_hourly_rate_min: 25 });
  ok('hourly rate below floor is rejected', hardFilter({ title: 'Fractional Ops', description: 'Pay: $18-20/hr', company: 'Acme' }).pass === false);
  ok('hourly rate at/above floor passes', hardFilter({ title: 'Fractional Ops', description: 'Pay: $28-32/hr', company: 'Acme' }).pass === true);
  ok('no stated hourly rate passes (most full-time postings)', hardFilter({ title: 'Product Manager', description: 'Competitive salary.', company: 'Acme' }).pass === true);
}

{
  const hardFilter = buildHardFilter({
    titles_excluded: ['VP'],
    overrides: [{ company: 'Acme Corp', reason: 'Local NJ office confirmed' }],
  });
  const result = hardFilter({ title: 'VP of Product', description: '', company: 'Acme Corp' });
  ok('a per-company override waives an otherwise-failing rule', result.pass === true);
  ok('override carries the configured reason', result.override === 'Local NJ office confirmed');
  ok('override does not apply to a different company', hardFilter({ title: 'VP of Product', description: '', company: 'Other Co' }).pass === false);
}

// ============================================================================
// buildRepostGate
// ============================================================================
console.log('buildRepostGate');

{
  const decided = new Map([['darkk alpha capital', ['Business Operations Manager']]]);
  const gate = buildRepostGate(decided, new Map());
  ok('exact title repost at a decided-against company is flagged', gate({ title: 'Business Operations Manager', company: 'Darkk Alpha Capital' }).isRepost === true);
  ok('flagged repost carries repost_of_decided_against reason', gate({ title: 'Business Operations Manager', company: 'Darkk Alpha Capital' }).reason === 'repost_of_decided_against');
  ok('a different role at the same company is not flagged', gate({ title: 'Software Engineer', company: 'Darkk Alpha Capital' }).isRepost === false);
  ok('the same role at a different company is not flagged', gate({ title: 'Business Operations Manager', company: 'Some Other Co' }).isRepost === false);
}

{
  // Key is the normalized company form (normalizeCompanyName), not the raw
  // display name — "Weiss-Aug" normalizes to "weiss aug" (hyphen folded to a
  // space), which is exactly what buildRepostGate computes internally too.
  const scanned = new Map([['weiss aug', ['Product Manager']]]);
  const gate = buildRepostGate(new Map(), scanned);
  ok('a title already recorded in scan-history is flagged', gate({ title: 'Product Manager', company: 'Weiss-Aug' }).isRepost === true);
  ok('flagged scanned repost carries repost_of_scanned reason', gate({ title: 'Product Manager', company: 'Weiss-Aug' }).reason === 'repost_of_scanned');
}

{
  const gate = buildRepostGate(new Map(), new Map());
  ok('empty history never flags anything', gate({ title: 'Product Manager', company: 'Anyone' }).isRepost === false);
}

// ============================================================================
// skip-reasons taxonomy (tracker-utils.mjs, live against templates/skip-reasons.yml)
// ============================================================================
console.log('skip-reasons taxonomy');

{
  const reasons = loadSkipReasons(SKIP_REASONS_FILE);
  ok('taxonomy has at least 10 reasons', reasons.length >= 10);
  ok('taxonomy includes not_my_domain', reasons.some(r => r.id === 'not_my_domain'));
  ok('taxonomy includes comp_too_low', reasons.some(r => r.id === 'comp_too_low'));
  ok('every reason has a non-empty id and label', reasons.every(r => r.id && r.label));

  ok('resolveSkipReason resolves by exact id', resolveSkipReason('not_my_domain', reasons) === 'not_my_domain');
  ok('resolveSkipReason resolves by label, case-insensitive', resolveSkipReason('comp too low', reasons) === 'comp_too_low');
  ok('resolveSkipReason resolves by label, original case', resolveSkipReason('Comp too low', reasons) === 'comp_too_low');
  ok('resolveSkipReason returns null for unknown input', resolveSkipReason('totally bogus reason', reasons) === null);
  ok('resolveSkipReason returns null for empty input', resolveSkipReason('', reasons) === null);
}

// ============================================================================
// loadHardFilters — reads config/profile.yml's hard_filters block live
// ============================================================================
console.log('loadHardFilters');

{
  // Missing profile path never throws, returns null (same "absent config
  // never filters" contract every other loader in scan.mjs uses).
  const hf = loadHardFilters('/nonexistent/path/profile.yml');
  ok('missing profile path returns null', hf === null);
}

// ============================================================================
// RESULTS
// ============================================================================
console.log(`\n${'='.repeat(78)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`\n  Failed tests:`);
  for (const f of failures) console.log(`    - ${f}`);
}
console.log(`${'='.repeat(78)}`);

process.exit(failed > 0 ? 1 : 0);
