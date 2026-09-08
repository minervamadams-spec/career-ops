import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { classifyTechnical, appendWatchOffers, loadSeenWatchUrls, formatSlackMessage, notifySlack, reclassifyWatchHistory, technicalOffersForAlert } from '../competitor-watch.mjs';
import { normalizeItem } from '../plugins/apify/index.mjs';

test('classifies technical title, description, non-technical, and unknown', () => {
  assert.deepEqual(classifyTechnical({ title: 'Senior .NET Backend Engineer' }).classification, 'technical');
  assert.deepEqual(classifyTechnical({ title: 'Facilities Manager' }).classification, 'non-technical');
  assert.deepEqual(classifyTechnical({ title: 'Data Center Technician' }).classification, 'technical');
  assert.deepEqual(classifyTechnical({ title: '', description: 'Operate the cloud infrastructure.' }).classification, 'non-technical');
  assert.deepEqual(classifyTechnical({ title: '', description: 'The Software Engineer owns this system.' }).classification, 'technical');
  assert.deepEqual(classifyTechnical({}).classification, 'unknown');
  assert.equal(classifyTechnical({ title: 'Platform Lead' }, ['Platform Lead']).classification, 'technical');
});

test('watch sink deduplicates independently and serializes required fields', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'competitor-watch-')), 'watch.tsv');
  const offer = { url: 'https://example.test/jobs/1', company: 'BGIS', title: 'Backend Engineer', location: 'US', postedAt: '2026-09-08', classification: 'technical', matchedKeywords: ['Backend'], source: 'apify-api' };
  await appendWatchOffers(file, [offer], '2026-09-08');
  assert(loadSeenWatchUrls(file).has(offer.url));
  assert.match(readFileSync(file, 'utf8'), /technical\tBackend\tapify-api/);
  const stale = `${offer.url}\t2026-09-08\tBGIS\tFacilities Manager\tUS\t\ttechnical\tIT\tapify-api\n`;
  await appendWatchOffers(file, [], '2026-09-08');
  const { appendFileSync } = await import('fs'); appendFileSync(file, stale);
  assert.equal(reclassifyWatchHistory(file), 1);
  assert.match(readFileSync(file, 'utf8'), /Facilities Manager\tUS\t\tnon-technical\t\tapify-api/);
});

test('Apify posted_at field maps an ISO posting date to the scanner timestamp', () => {
  const job = normalizeItem(
    { title: 'Lead Critical Facility Engineer', url: 'https://example.test/jobs/1', companyName: 'BGIS', postedDate: '2026-08-29T00:00:00.000Z', description: '<p>Operate cloud infrastructure.</p>' },
    { title: 'title', url: 'url', company: 'companyName', posted_at: 'postedDate', description: 'description' },
  );
  assert.equal(new Date(job.postedAt).toISOString().slice(0, 10), '2026-08-29');
  assert.equal(job.description, 'Operate cloud infrastructure.');
});

test('Slack notifier groups companies, highlights technical roles, and safely no-ops', async () => {
  const offers = [{ url: 'https://example.test/a', company: 'BGIS', title: 'Backend Engineer', postedAt: '2026-09-08', classification: 'technical' }, { url: 'https://example.test/b', company: 'Veritas', title: 'Accountant', classification: 'non-technical' }];
  assert.deepEqual(technicalOffersForAlert(offers), [offers[0]]);
  assert.match(formatSlackMessage(offers, '2026-09-08'), /\*BGIS\*[\s\S]*⚠️ Technical hire/);
  const logs = []; assert.equal((await notifySlack(offers, '2026-09-08', { log: s => logs.push(s) })).reason, 'no-webhook');
  let payload; const result = await notifySlack(offers, '2026-09-08', { webhookUrl: 'https://hooks.slack.test/x', fetchImpl: async (_u, init) => { payload = JSON.parse(init.body); return { ok: true }; }, log() {} });
  assert.equal(result.sent, true); assert.match(payload.text, /Backend Engineer/);
});
