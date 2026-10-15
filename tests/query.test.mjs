import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, validateFilters, cleanSearch, fetchAll, exportFilename, DATASETS, DISTRICTS } from '../admin/query.mjs';
import { evalQuery } from './pgrest-sim.mjs';

// ---- synthetic members (no real data) ----
const N = 25000;
const members = Array.from({ length: N }, (_, i) => ({
  id: 'u' + i, member_id: 'YW-' + String(i + 1).padStart(6, '0'), name: (i % 7 ? 'Arun ' : 'Priya ') + i,
  district: DISTRICTS[i % DISTRICTS.length], contact: '98' + String(10000000 + i).slice(-8), voter_last4: '1234',
  wants_kit: i % 3 === 0, kit_size: 'M', kit_address: 'Street ' + i, kit_pincode: '600001',
  created_at: new Date(Date.UTC(2026, 0, 1) + (i % 300) * 86400000 + 3600000).toISOString(), voter_hash: 'SECRET'
}));
const db = { yw_admin_members: members };
const page = path => (off, lim) => Promise.resolve(evalQuery(path, db).slice(off, off + lim));
const manual = r => r.district === 'Chennai' && r.created_at >= '2026-01-01' && r.created_at < '2026-10-01' && r.wants_kit;

test('single filter: district', () => {
  const rows = evalQuery(buildQuery('members', { district: 'Madurai' }), db);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(r => r.district === 'Madurai'));
  assert.equal(rows.length, members.filter(r => r.district === 'Madurai').length);
});

test('multiple filters combine with AND (district + date range + kit)', () => {
  const rows = evalQuery(buildQuery('members', { district: 'Chennai', from: '2026-01-01', to: '2026-09-30', wants_kit: 'true' }), db);
  assert.equal(rows.length, members.filter(manual).length);
  assert.ok(rows.length > 0);
});

test('date "to" is inclusive of the whole day', () => {
  const q = buildQuery('members', { to: '2026-01-01' });
  assert.match(q, /created_at=lt.2026-01-02/);
  const rows = evalQuery(q, db);
  assert.ok(rows.every(r => r.created_at < '2026-01-02'));
  assert.ok(rows.some(r => r.created_at.startsWith('2026-01-01')));
});

test('search is applied across name/contact/member_id', () => {
  const rows = evalQuery(buildQuery('members', { q: 'YW-000042' }), db);
  assert.deepEqual(rows.map(r => r.member_id), ['YW-000042']);
});

test('export of filtered set equals the filtered table (batched)', async () => {
  const path = buildQuery('members', { district: 'Chennai', from: '2026-01-01', to: '2026-09-30', wants_kit: 'true' });
  const all = await fetchAll(page(path), { batch: 100 });
  assert.equal(all.length, members.filter(manual).length);
  assert.ok(all.every(r => r.district === 'Chennai' && r.wants_kit));
});

test('large dataset: 25k rows fetched in 1000-row batches', async () => {
  let calls = 0;
  const path = buildQuery('members', {});
  const all = await fetchAll((o, l) => { calls++; return page(path)(o, l); }, { batch: 1000 });
  assert.equal(all.length, N);
  assert.equal(calls, 26);
});

test('cap stops runaway exports', async () => {
  await assert.rejects(fetchAll(page(buildQuery('members', {})), { batch: 1000, cap: 5000 }), /Narrow the filters/);
});

test('empty result is handled', async () => {
  const all = await fetchAll(page(buildQuery('members', { q: 'nobody-matches-this' })));
  assert.deepEqual(all, []);
});

test('never selects columns outside the allow-list (voter_hash)', () => {
  const q = buildQuery('members', {}, { columns: ['name', 'voter_hash', 'aadhaar_hash'] });
  const sel = new URLSearchParams(q.split('?')[1]).get('select').split(',');
  assert.ok(!sel.includes('voter_hash') && !sel.includes('aadhaar_hash'));
  assert.ok(evalQuery(q, db).every(r => !('voter_hash' in r)));
  for (const ds of Object.values(DATASETS)) assert.ok(!ds.columns.some(c => /hash|token|password|pepper/.test(c.key)));
});

test('rejects invalid filters', () => {
  assert.throws(() => validateFilters('members', { district: 'Atlantis' }), /district/);
  assert.throws(() => validateFilters('members', { from: '2026-13-01' }), /date/);
  assert.throws(() => validateFilters('members', { from: '2026-02-30' }), /date/);
  assert.throws(() => validateFilters('members', { from: '2026-05-01', to: '2026-04-01' }), /after/);
  assert.throws(() => validateFilters('complaints', { status: 'Hacked' }), /status/);
  assert.throws(() => buildQuery('nope', {}), /Unknown/);
});

test('search cannot inject PostgREST grammar', () => {
  assert.equal(cleanSearch('a),id.not.is.null,(b*'), 'a id.not.is.null b');
  const q = buildQuery('members', { q: 'x),voter_hash.neq.(' });
  assert.ok(!/voter_hash/.test(new URLSearchParams(q.split('?')[1]).get('select')));
  assert.equal((new URLSearchParams(q.split('?')[1]).get('or').match(/\(/g) || []).length, 1);
});

test('unknown sort falls back to safe default', () => {
  assert.match(buildQuery('ideas', {}, { sort: 'pg_sleep(10)' }), /order=created_at.desc/);
});

test('complaints and ideas filters', () => {
  const tables = { yw_complaints: [
    { id: 1, ticket: 'YW-C-AAAAAA', category: 'Party', district: 'Salem', status: 'New', description: 'x', created_at: '2026-03-01T00:00:00Z' },
    { id: 2, ticket: 'YW-C-BBBBBB', category: 'Event', district: 'Salem', status: 'Resolved', description: 'y', created_at: '2026-03-02T00:00:00Z' }] };
  const r = evalQuery(buildQuery('complaints', { district: 'Salem', status: 'Resolved' }), tables);
  assert.deepEqual(r.map(x => x.ticket), ['YW-C-BBBBBB']);
});

test('filename uses runtime IST date', () => {
  assert.equal(exportFilename('members', 'xlsx', new Date('2026-10-14T20:00:00Z')), 'Youth_Wing_Members_2026-10-15.xlsx');
});
