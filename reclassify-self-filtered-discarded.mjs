#!/usr/bin/env node
/**
 * reclassify-self-filtered-discarded.mjs — one-time migration for the SKIP vs
 * Discarded classification bug (career-ops offerly scoring brief, 2026-09-22,
 * scope item 5).
 *
 * modes/patterns.md's classification table assumes Discarded means "company
 * said no / offer closed" (negative) and SKIP means "candidate decided not to
 * apply" (self-filtered). In practice, every "Skip" control in the web app
 * (DecisionCard, StatusSelect, LeadsTable — now fixed, see status-select.tsx /
 * home/decision-card.tsx / leads/leads-table.tsx) wrote status=Discarded with
 * a "Passed: <reason>" note, which is unambiguously a self-filter decision.
 * That produced 72 Discarded rows in data/applications.md that are actually
 * self-filtered and corrupt analyze-patterns.mjs's scoreComparison /
 * archetypeBreakdown numbers, which assume the two statuses never overlap.
 *
 * This script finds exactly those rows (status Discarded, Notes containing
 * "Passed:") and flips their status to SKIP via set-status.mjs — the
 * canonical, locked, atomic, status-log-audited write path — one row at a
 * time. It also maps each row's existing free-text reason to the new
 * templates/skip-reasons.yml taxonomy (via --reason) so the structured signal
 * exists retroactively too, not just for future skips. The original
 * "Passed: ..." text is left untouched in the Notes cell (set-status.mjs
 * APPENDS the reason tag as a new segment) — nothing is deleted or rewritten,
 * so the migration is fully reversible via git or a second set-status.mjs
 * call.
 *
 * Run: node reclassify-self-filtered-discarded.mjs --dry-run   (preview, no writes)
 *      node reclassify-self-filtered-discarded.mjs             (apply)
 *      node reclassify-self-filtered-discarded.mjs --json      (machine-readable)
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { resolveColumns, parseTrackerRow } from './tracker-parse.mjs';

const CAREER_OPS = dirname(fileURLToPath(import.meta.url));
const APPS_FILE = join(CAREER_OPS, 'data/applications.md');
const SET_STATUS = join(CAREER_OPS, 'set-status.mjs');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonMode = args.includes('--json');

// Exact mapping mined by hand from the 72 rows' actual "Passed: <reason>"
// text (2026-09-22) — see the brief's evidence point 3 for the frequency
// counts this vocabulary came from. A reason not in this table falls back to
// skill_or_background_mismatch (the taxonomy's explicit catchall) rather than
// blocking the migration.
const REASON_MAP = {
  'already applied elsewhere': 'duplicate_of_existing',
  'bilingual': 'skill_or_background_mismatch',
  'comp too low': 'comp_too_low',
  'expertise is not in finance': 'skill_or_background_mismatch',
  'expired listing': 'expired_listing',
  'expired post': 'expired_listing',
  'i do not qualify': 'not_qualified',
  "i don't have a developer background": 'skill_or_background_mismatch',
  'location/remote': 'location_or_remote_restricted',
  'no expertise as a business analyst': 'skill_or_background_mismatch',
  'no information given': 'skill_or_background_mismatch',
  'no sales': 'skill_or_background_mismatch',
  'no wording': 'skill_or_background_mismatch',
  'not my domain': 'not_my_domain',
  'only part time': 'unwanted_part_time_or_fractional',
  'part time': 'unwanted_part_time_or_fractional',
  'pass on salesops': 'skill_or_background_mismatch',
  'posting expired': 'expired_listing',
  'travel required': 'travel_required',
};

// Text right after "Passed:" up to the first boundary — "; ", ". re-eval"
// (a later re-evaluation's own log text, not part of the original reason), or
// end of string. Re-eval trailers exist on ~15 of the 72 rows and would
// otherwise pollute the mapped reason with unrelated comp/location text from
// a LATER re-score, not the original pass decision.
function extractReason(notes) {
  const m = (notes || '').match(/Passed:\s*([^;]+?)(?:\.\s*re-eval|;|$)/i);
  return m ? m[1].trim() : null;
}

function findRows() {
  if (!existsSync(APPS_FILE)) {
    console.error(`No tracker found at ${APPS_FILE}`);
    process.exit(1);
  }
  const lines = readFileSync(APPS_FILE, 'utf-8').split('\n');
  const colmap = resolveColumns(lines);
  const rows = lines.map(l => parseTrackerRow(l, colmap)).filter(Boolean);
  return rows
    .filter(r => /^discard/i.test(r.status || '') && /Passed:/i.test(r.notes || ''))
    .map(r => {
      const rawReason = extractReason(r.notes);
      const key = (rawReason || '').toLowerCase();
      const reasonId = REASON_MAP[key] || 'skill_or_background_mismatch';
      return { num: r.num, company: r.company, role: r.role, rawReason, reasonId };
    });
}

function main() {
  const targets = findRows();

  if (jsonMode && dryRun) {
    console.log(JSON.stringify({ dryRun: true, count: targets.length, targets }, null, 2));
    return;
  }
  if (!jsonMode) {
    console.log(`Found ${targets.length} Discarded rows with self-filter "Passed:" language.`);
    for (const t of targets) {
      console.log(`  #${t.num}\t${t.company}\t"${t.rawReason}" -> reason=${t.reasonId}`);
    }
  }
  if (dryRun) {
    if (!jsonMode) console.log('\n(dry run — nothing written; re-run without --dry-run to apply)');
    return;
  }

  const results = [];
  for (const t of targets) {
    try {
      const out = execFileSync('node', [SET_STATUS, '--row', String(t.num), 'SKIP', '--reason', t.reasonId, '--json'], { encoding: 'utf-8' });
      results.push({ num: t.num, ok: true, result: JSON.parse(out) });
    } catch (err) {
      results.push({ num: t.num, ok: false, error: err.message });
    }
  }

  const succeeded = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  if (jsonMode) {
    console.log(JSON.stringify({ dryRun: false, count: targets.length, succeeded, failed: failed.length, results }, null, 2));
  } else {
    console.log(`\nApplied: ${succeeded}/${targets.length} rows reclassified Discarded -> SKIP.`);
    if (failed.length) {
      console.log(`Failed (${failed.length}):`);
      for (const f of failed) console.log(`  #${f.num}: ${f.error}`);
    }
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
