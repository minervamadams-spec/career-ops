#!/usr/bin/env node
/**
 * backfill-archetype-companysize.mjs — deterministic archetype/company-size
 * tagger for existing tracker rows (career-ops offerly scoring brief,
 * 2026-09-22).
 *
 * analyze-patterns.mjs's archetypeBreakdown/companySizeBreakdown are "Unknown"
 * for ~94-98% of the 291 tracked rows — not because the classifier is broken,
 * but because those fields only ever come from a linked report's Machine
 * Summary YAML, and 274/291 rows never went through a full evaluation (they
 * were scored/decided from the cheap scan tier and have no report file at
 * all). Re-running the full LLM evaluation on 267 historical rows just to
 * backfill two fields is explicitly out of scope (AGENTS.md non-goals) — this
 * does it with zero LLM cost, from title/company text alone.
 *
 * Output is a REVERSIBLE sidecar file, `data/archetype-tags.json`, never a
 * rewrite of applications.md or a fabricated report file:
 *   - It's a single, small, git-diffable JSON file Minerva can read, edit, or
 *     delete in one look — the non-goal against bulk-reclassifying rows
 *     without a migration she can review is satisfied by the artifact ITSELF
 *     being the reviewable migration, not a hidden side effect.
 *   - analyze-patterns.mjs (loadTagOverrides) only consults it as a FALLBACK
 *     when a linked report supplies no value — a real report always wins.
 *
 * Archetype coverage is expected to be high: nearly every tracked row has a
 * role title, and title-keyword matching is a reasonable proxy for archetype.
 * Company-size coverage will stay PARTIAL and is not oversold as complete —
 * no report or scan data source gives real headcount for most companies, so
 * only known_large_companies (config/profile.yml hard_filters), government/
 * municipal keyword matches, and a few explicit startup/enterprise phrases in
 * the title or company name get tagged. The rest are left 'unknown' rather
 * than guessed.
 *
 * Run: node backfill-archetype-companysize.mjs              (writes the sidecar)
 *      node backfill-archetype-companysize.mjs --dry-run    (preview only)
 *      node backfill-archetype-companysize.mjs --json       (machine-readable summary)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as yamlLoad } from 'js-yaml';
import { resolveColumns, parseTrackerRow } from './tracker-parse.mjs';

const CAREER_OPS = dirname(fileURLToPath(import.meta.url));
const APPS_FILE = join(CAREER_OPS, 'data/applications.md');
const PROFILE_FILE = join(CAREER_OPS, 'config/profile.yml');
const OUT_FILE = join(CAREER_OPS, 'data/archetype-tags.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonMode = args.includes('--json');

// Canonical archetype names from config/profile.yml `target_roles.archetypes`.
// Order matters — first match wins, most-specific first, so a Court Clerk
// posting matches Legal Operations before the generic "manager" keywords
// under Operations Manager ever get a chance to.
//
// Two match tiers per rule: `any` is an exact-phrase match (high confidence);
// `allWords` is a fallback word-set match (order-independent, word-boundary)
// for titles that carry the same concept in a different word order —
// "Manager Operations", "Strategic Product Portfolio Manager", "Sr. Business
// Transformation Analyst" — which a contiguous-phrase-only rule would miss
// entirely (verified against this tracker's actual untagged titles).
const ARCHETYPE_RULES = [
  {
    name: 'Legal Operations / Court Administrator',
    any: ['court administrator', 'clerk', 'judiciary', 'legal operations', 'legal ops', 'paralegal manager'],
  },
  {
    name: 'Business Analyst',
    any: ['business analyst', 'business analysis', 'ba consultant'],
    allWords: ['business', 'analyst'],
  },
  {
    name: 'Product Manager',
    any: ['product manager', 'product owner', 'product management', 'product lead', 'aipm'],
    allWords: ['product', 'manager'],
  },
  {
    name: 'Operations Manager / Product Operations',
    any: ['operations manager', 'product operations', 'business operations', 'ops manager', 'operations lead', 'operations director', 'operations coordinator'],
    allWords: ['operations', 'manager'],
  },
  {
    name: 'Program Manager',
    any: ['program manager', 'project manager', 'delivery manager', 'pmo', 'program lead', 'owners rep'],
    allWords: ['program', 'manager'],
  },
  {
    name: 'Part-time/fractional PM, Ops, PgM, BA, EA/VA, Office Manager',
    any: ['executive assistant', 'virtual assistant', 'office manager', 'administrative assistant'],
  },
];

function hasAllWords(text, words) {
  return words.every(w => new RegExp(`\\b${w}\\b`).test(text));
}

function classifyArchetype(role) {
  const text = (role || '').toLowerCase();
  if (!text.trim()) return null;
  for (const rule of ARCHETYPE_RULES) {
    if (rule.any.some(k => text.includes(k))) return rule.name;
  }
  // Second pass, not interleaved with the first: an exact-phrase match for a
  // LATER rule must win over an allWords fallback for an EARLIER one — e.g.
  // "Business Operations Manager" should land in Operations Manager /
  // Product Operations (exact phrase) even though it also satisfies Business
  // Analyst's allWords ['business','analyst']... which it doesn't, but the
  // principle generalizes: exact phrases across all rules outrank every
  // rule's word-set fallback.
  for (const rule of ARCHETYPE_RULES) {
    if (rule.allWords && hasAllWords(text, rule.allWords)) return rule.name;
  }
  return null;
}

const GOV_KEYWORDS_DEFAULT = ['county', 'township', 'borough', 'municipal', 'city of', 'state of', 'department of', 'judiciary'];
const STARTUP_PHRASES = ['startup', 'early-stage', 'early stage', 'seed-stage', 'seed stage', 'boutique'];
const ENTERPRISE_PHRASES = ['fortune 500', 'publicly traded', 'nyse:', 'nasdaq:'];

function loadHardFilterHints(profilePath) {
  if (!existsSync(profilePath)) return { knownLarge: [], govKeywords: GOV_KEYWORDS_DEFAULT };
  try {
    const raw = yamlLoad(readFileSync(profilePath, 'utf-8')) || {};
    const hf = raw.hard_filters || {};
    const knownLarge = (Array.isArray(hf.known_large_companies) ? hf.known_large_companies : [])
      .filter(s => typeof s === 'string').map(s => s.toLowerCase());
    const govKeywords = (Array.isArray(hf.local_government_exempt_keywords) ? hf.local_government_exempt_keywords : GOV_KEYWORDS_DEFAULT)
      .filter(s => typeof s === 'string').map(s => s.toLowerCase());
    return { knownLarge, govKeywords: govKeywords.length ? govKeywords : GOV_KEYWORDS_DEFAULT };
  } catch {
    return { knownLarge: [], govKeywords: GOV_KEYWORDS_DEFAULT };
  }
}

function classifyCompanySize(company, role, hints) {
  const companyLower = (company || '').toLowerCase();
  const text = `${companyLower} ${(role || '').toLowerCase()}`;
  if (!companyLower.trim() || companyLower === '?') return null;
  if (hints.knownLarge.some(k => companyLower.includes(k))) return 'enterprise';
  if (hints.govKeywords.some(k => text.includes(k))) return 'government';
  if (STARTUP_PHRASES.some(k => text.includes(k))) return 'startup';
  if (ENTERPRISE_PHRASES.some(k => text.includes(k))) return 'enterprise';
  return null; // No signal — leave unknown rather than guess.
}

function main() {
  if (!existsSync(APPS_FILE)) {
    console.error(`No tracker found at ${APPS_FILE}`);
    process.exit(1);
  }
  const lines = readFileSync(APPS_FILE, 'utf-8').split('\n');
  const colmap = resolveColumns(lines);
  const rows = lines.map(l => parseTrackerRow(l, colmap)).filter(Boolean);

  const hints = loadHardFilterHints(PROFILE_FILE);
  const existing = existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, 'utf-8')) : {};
  const today = new Date().toISOString().slice(0, 10);

  const out = { ...existing };
  let archetypeTagged = 0;
  let companySizeTagged = 0;
  let rowsTouched = 0;

  for (const row of rows) {
    const archetype = classifyArchetype(row.role);
    const companySize = classifyCompanySize(row.company, row.role, hints);
    if (!archetype && !companySize) continue;
    rowsTouched++;
    const entry = { ...(out[String(row.num)] || {}) };
    if (archetype) { entry.archetype = archetype; archetypeTagged++; }
    if (companySize) { entry.companySize = companySize; companySizeTagged++; }
    entry.source = 'heuristic-backfill';
    entry.taggedAt = today;
    out[String(row.num)] = entry;
  }

  const summary = {
    trackerRows: rows.length,
    rowsTouched,
    archetypeTagged,
    companySizeTagged,
    outFile: OUT_FILE,
    dryRun,
  };

  if (!dryRun) {
    writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  }

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Tracker rows scanned: ${summary.trackerRows}`);
    console.log(`Rows tagged (archetype and/or companySize): ${summary.rowsTouched}`);
    console.log(`  archetype tagged:    ${summary.archetypeTagged}`);
    console.log(`  companySize tagged:  ${summary.companySizeTagged}`);
    console.log(dryRun ? '(dry run — nothing written)' : `Written to ${OUT_FILE}`);
  }
}

main();
