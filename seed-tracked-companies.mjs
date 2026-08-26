#!/usr/bin/env node
/**
 * Derive the company-careers research queue from the canonical tracker.
 *
 * This intentionally does not guess or write a careers URL. A branded careers
 * page is a factual, per-company claim and must be verified before an entry is
 * added to portals.yml. The output is idempotent: it excludes exact, casing,
 * punctuation, and high-confidence near-duplicate tracked-company names.
 *
 * Usage: node seed-tracked-companies.mjs [--json]
 */
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { resolveColumns, parseTrackerRow } from './tracker-parse.mjs';

export function normalizeCompanyName(value) {
  return String(value || '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|company|co|group)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function tokenSet(value) {
  return new Set(String(value || '').toLowerCase().match(/[a-z0-9]+/g) || []);
}

export function isNearDuplicate(candidate, existing) {
  const a = normalizeCompanyName(candidate), b = normalizeCompanyName(existing);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const at = tokenSet(candidate), bt = tokenSet(existing);
  const overlap = [...at].filter(t => bt.has(t)).length;
  return overlap >= 2 && overlap / Math.min(at.size, bt.size) >= 0.8;
}

export function deriveCompanySeeds(applicationsMarkdown, trackedCompanies) {
  const lines = String(applicationsMarkdown || '').split('\n');
  const columns = resolveColumns(lines);
  const names = new Map();
  for (const line of lines) {
    const row = parseTrackerRow(line, columns);
    if (!row) continue;
    const score = Number.parseFloat(String(row.score || ''));
    const applied = String(row.status || '').replace(/\*\*/g, '').trim().toLowerCase() === 'applied';
    if ((score >= 4 || applied) && row.company?.trim()) {
      // Keep the first tracker spelling so a later suffix/casing variant does
      // not produce a second research target (e.g. Weiss-Aug / Weiss-Aug Group).
      const key = normalizeCompanyName(row.company);
      if (!names.has(key)) names.set(key, row.company.trim());
    }
  }
  const existing = (trackedCompanies || []).map(c => typeof c === 'string' ? c : c?.name).filter(Boolean);
  return [...names.values()].filter(name => !existing.some(current => isNearDuplicate(name, current))).sort((a, b) => a.localeCompare(b));
}

function main() {
  const json = process.argv.includes('--json');
  const apps = readFileSync('data/applications.md', 'utf8');
  const portals = yaml.load(readFileSync('portals.yml', 'utf8')) || {};
  const seeds = deriveCompanySeeds(apps, portals.tracked_companies || []);
  const payload = { generatedAt: new Date().toISOString(), count: seeds.length, companies: seeds };
  if (json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`# Company-careers research queue (${seeds.length})`);
    console.log('# Verify the branded careers URL, then add it to tracked_companies with enabled: true.');
    for (const name of seeds) console.log(`- ${name}`);
  }
}
if (import.meta.url === new URL(process.argv[1], 'file:').href) main();
