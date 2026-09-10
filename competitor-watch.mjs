/** Deterministic, isolated competitor-hiring watch state and notifications. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { withPipelineLock } from './pipeline-lock.mjs';

export const DEFAULT_TECHNICAL_KEYWORDS = [
  'CTO', 'Chief Technology', 'VP Engineering', 'Head of Engineering', 'Engineering Manager',
  'Software Engineer', 'Software Developer', 'Programmer', 'Backend', 'Back-end', 'Server',
  'Full Stack', 'Frontend', 'Front-end', 'DevOps', 'SRE', 'Platform Engineer', 'Data Engineer',
  'Data Scientist', 'Business Intelligence', 'Data Analytics', 'Data Center', 'Cloud', 'Infrastructure', 'IT', 'Systems Administrator', 'Systems Engineer',
  'Architect', 'QA Engineer', 'SDET', 'Security Engineer', 'Machine Learning', 'AI Engineer',
];

const HEADER = 'url\tfirst_seen\tcompany\ttitle\tlocation\tposted_at\tclassification\tmatched_keywords\tsource\n';
const clean = (value) => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const isStrongDescriptionTerm = (term) => /^(CTO|Chief Technology|VP Engineering|Head of Engineering|Engineering Manager|Software Engineer|Software Developer|Programmer|DevOps|SRE|Platform Engineer|Data Engineer|Data Scientist|Business Intelligence|Data Analytics|Data Center|Systems Administrator|Systems Engineer|QA Engineer|SDET|Security Engineer|Machine Learning|AI Engineer)$/i.test(term);

export function isHttpsUrl(value) {
  try { return new URL(String(value)).protocol === 'https:'; } catch { return false; }
}

export function normalizeWatchConfig(raw) {
  if (!raw || typeof raw !== 'object' || raw.enabled === false) return { enabled: false, companies: [], keywords: DEFAULT_TECHNICAL_KEYWORDS };
  const companies = Array.isArray(raw.companies) ? raw.companies.filter(c => c && typeof c === 'object' && c.enabled !== false) : [];
  const keywords = Array.isArray(raw.technical_keywords)
    ? raw.technical_keywords.filter(k => typeof k === 'string' && k.trim()).map(k => k.trim())
    : DEFAULT_TECHNICAL_KEYWORDS;
  return { enabled: raw.enabled === true, companies, keywords };
}

export function classifyTechnical({ title, description } = {}, keywords = DEFAULT_TECHNICAL_KEYWORDS) {
  const terms = Array.isArray(keywords) ? keywords.filter(k => typeof k === 'string' && k.trim()) : DEFAULT_TECHNICAL_KEYWORDS;
  const find = (text) => terms.filter(term => {
    const value = String(text ?? '');
    // Acronyms such as IT/SRE need boundaries: plain substring matching would
    // incorrectly classify "Facilities Manager" as technical through "IT".
    if (/^[a-z]{2,3}$/i.test(term)) return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i').test(value);
    return value.toLocaleLowerCase().includes(term.toLocaleLowerCase());
  });
  const titleMatches = find(title);
  // Job descriptions commonly mention generic IT, cloud, infrastructure, and
  // architects for unrelated roles. They cannot by themselves make a role
  // technical unless they name a specific technical job family.
  const descriptionMatches = titleMatches.length ? [] : find(description).filter(isStrongDescriptionTerm);
  const matchedKeywords = [...new Set([...titleMatches, ...descriptionMatches])];
  if (matchedKeywords.length) return { classification: 'technical', matchedKeywords };
  if (clean(title) || clean(description)) return { classification: 'non-technical', matchedKeywords: [] };
  return { classification: 'unknown', matchedKeywords: [] };
}

export function loadSeenWatchUrls(filePath) {
  if (!existsSync(filePath)) return new Set();
  return new Set(readFileSync(filePath, 'utf8').split('\n').slice(1).map(line => line.split('\t')[0]).filter(Boolean));
}

/** Refresh prior watch classifications after classifier improvements. */
export function reclassifyWatchHistory(filePath, keywords = DEFAULT_TECHNICAL_KEYWORDS) {
  if (!existsSync(filePath)) return 0;
  const lines = readFileSync(filePath, 'utf8').split('\n');
  let changed = 0;
  const refreshed = lines.map((line, index) => {
    if (!line || index === 0) return line;
    const fields = line.split('\t');
    const result = classifyTechnical({ title: fields[3] }, keywords);
    const matched = result.matchedKeywords.join(', ');
    if (fields[6] === result.classification && fields[7] === matched) return line;
    fields[6] = result.classification;
    fields[7] = matched;
    changed++;
    return fields.join('\t');
  });
  if (changed) writeFileSync(filePath, refreshed.join('\n'), 'utf8');
  return changed;
}

export function formatWatchRow(offer, date) {
  return [offer.url, date, offer.company, offer.title, offer.location, offer.postedAt || '', offer.classification,
    (offer.matchedKeywords || []).join(', '), offer.source].map(clean).join('\t');
}

export async function appendWatchOffers(filePath, offers, date) {
  if (!offers.length) return;
  await withPipelineLock(filePath, () => {
    if (!existsSync(filePath)) {
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, HEADER, 'utf8');
    }
    appendFileSync(filePath, offers.map(o => formatWatchRow(o, date)).join('\n') + '\n', 'utf8');
  });
}

export function formatSlackMessage(offers, date) {
  const byCompany = new Map();
  for (const offer of offers) {
    const list = byCompany.get(offer.company) || [];
    list.push(offer); byCompany.set(offer.company, list);
  }
  const lines = [`Competitor hiring watch — ${date}`];
  for (const [company, jobs] of byCompany) {
    lines.push(`\n*${company} — ⚠️ Technical hires*`);
    for (const job of jobs) lines.push(`• <${job.url}|${job.title}>${job.postedAt ? ` — posted ${job.postedAt}` : ''}`);
  }
  return lines.join('\n');
}

/** Only technical roles are actionable replacement-risk signals in Slack. */
export function technicalOffersForAlert(offers) {
  return offers.filter(offer => offer.classification === 'technical');
}

/** Daily heartbeat, used only by the launchd scheduler when no technical role is new. */
export async function notifySlackNoUpdates(date, { webhookUrl = process.env.COMPETITOR_WATCH_SLACK_WEBHOOK_URL, fetchImpl = globalThis.fetch, log = console.log } = {}) {
  if (!webhookUrl) { log('Competitor watch: Slack skipped — COMPETITOR_WATCH_SLACK_WEBHOOK_URL is not set.'); return { sent: false, reason: 'no-webhook' }; }
  const text = `Competitor hiring watch — ${date}\nNo new technical BGIS or Veritas roles today.`;
  try {
    const response = await fetchImpl(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    log('Competitor watch: Slack no-updates heartbeat sent.');
    return { sent: true, text };
  } catch (err) {
    console.warn(`Competitor watch: Slack heartbeat failed (${err.message}); scan still completed.`);
    return { sent: false, reason: 'network-error', text };
  }
}

export async function notifySlack(offers, date, { webhookUrl = process.env.COMPETITOR_WATCH_SLACK_WEBHOOK_URL, fetchImpl = globalThis.fetch, log = console.log } = {}) {
  if (!offers.length) return { sent: false, reason: 'no-new-postings' };
  if (!webhookUrl) { log('Competitor watch: Slack skipped — COMPETITOR_WATCH_SLACK_WEBHOOK_URL is not set.'); return { sent: false, reason: 'no-webhook' }; }
  const text = formatSlackMessage(offers, date);
  try {
    const response = await fetchImpl(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    log(`Competitor watch: Slack alert sent for ${offers.length} new posting(s).`);
    return { sent: true, text };
  } catch (err) {
    console.warn(`Competitor watch: Slack alert failed (${err.message}); postings were still recorded.`);
    return { sent: false, reason: 'network-error', text };
  }
}
