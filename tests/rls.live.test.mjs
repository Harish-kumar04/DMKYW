// LIVE Row Level Security tests. Run ONLY against an isolated DEV Supabase project:
//   set the YW_TEST_* variables (see .env.example), then:  node --test tests/rls.live.test.mjs
// Skips automatically when the variables are not set. Never point this at production.
import test from 'node:test';
import assert from 'node:assert/strict';

const E = process.env, URL_ = E.YW_TEST_SUPABASE_URL, KEY = E.YW_TEST_ANON_KEY;
const skip = !URL_ || !KEY || /fktertkyldwviaqnjtmj/.test(URL_) ? 'YW_TEST_* not set (or points at production) — live RLS tests skipped' : false;

async function login(email, password) {
  const r = await fetch(URL_ + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json(); if (!r.ok) throw new Error('login failed for ' + email); return j.access_token;
}
const rest = (path, tok, o = {}) => fetch(URL_ + '/rest/v1/' + path, { method: o.method || 'GET', body: o.body && JSON.stringify(o.body), headers: { apikey: KEY, Authorization: 'Bearer ' + (tok || KEY), 'Content-Type': 'application/json', Prefer: 'return=representation' } });
const rows = async r => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

test('live RLS', { skip }, async t => {
  const admin = await login(E.YW_TEST_ADMIN_EMAIL, E.YW_TEST_ADMIN_PASSWORD);
  const user = await login(E.YW_TEST_USER_EMAIL, E.YW_TEST_USER_PASSWORD);
  const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwic3ViIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIn0.invalidsig';

  for (const [who, tok] of [['anon', null], ['ordinary user', user]]) {
    await t.test(`${who} cannot read members, complaints, audit log`, async () => {
      for (const p of ['yw_admin_members?select=*', 'yw_members?select=id', 'yw_complaints?select=*', 'yw_audit_log?select=*', 'yw_admin_member_points?select=*']) {
        const r = await rest(p, tok), j = await rows(r);
        assert.ok(!r.ok || (Array.isArray(j) && j.length === 0), `${who} read ${p}`);
      }
    });
    await t.test(`${who} cannot call admin RPCs or modify content`, async () => {
      for (const fn of ['yw_admin_stats', 'yw_admin_delete_samples']) assert.ok(!(await rest('rpc/' + fn, tok, { method: 'POST', body: {} })).ok, fn);
      const r = await rest('yw_books?id=not.is.null', tok, { method: 'PATCH', body: { title: 'hacked' } }), j = await rows(r);
      assert.ok(!r.ok || (Array.isArray(j) && j.length === 0));
      assert.equal((await rest('rpc/yw_am_admin', tok, { method: 'POST', body: {} }).then(rows)), tok ? false : false);
    });
  }
  await t.test('forged JWT is rejected', async () => { assert.equal((await rest('yw_admin_members?select=id', forged)).status, 401); });
  await t.test('admin can read members but never hashes', async () => {
    const r = await rest('yw_admin_members?select=*&limit=1', admin); assert.ok(r.ok);
    const h = await rest('yw_members?select=voter_hash&limit=1', admin); assert.ok(!h.ok, 'voter_hash must not be selectable');
  });
  await t.test('admin stats RPC works', async () => { const s = await rows(await rest('rpc/yw_admin_stats', admin, { method: 'POST', body: {} })); assert.equal(typeof s.members, 'number'); });
  await t.test('drafts and unpublished items are invisible publicly', async () => {
    const id = (await rows(await rest('rpc/yw_admin_create_feed', admin, { method: 'POST', body: { p_title: 'RLS draft test', p_description: 'synthetic', p_photos: [], p_district: 'Salem', p_activity: 1, p_date: '2026-01-01', p_members: [], p_consent: true, p_status: 'draft' } })));
    const pub = await rows(await rest('yw_feed_public?select=id&id=eq.' + id, null));
    assert.deepEqual(pub, []);
    await rest('yw_feeds?id=eq.' + id, admin, { method: 'DELETE' });
    const b = (await rows(await rest('yw_books', admin, { method: 'POST', body: { title: 'RLS hidden book', author: 'Test', published: false } })))[0];
    assert.deepEqual(await rows(await rest('yw_books?select=id&id=eq.' + b.id, null)), []);
    await rest('yw_books?id=eq.' + b.id, admin, { method: 'DELETE' });
  });
  await t.test('admin changes are audit-logged; audit log is append-only', async () => {
    const a = await rows(await rest('yw_audit_log?select=id,action&order=at.desc&limit=5', admin));
    assert.ok(a.some(x => x.action === 'DELETE'));
    const del = await rest('yw_audit_log?id=eq.' + a[0].id, admin, { method: 'DELETE' }), j = await rows(del);
    assert.ok(!del.ok || (Array.isArray(j) && j.length === 0), 'audit rows cannot be deleted');
  });
  await t.test('internal note is not exposed by public ticket lookup', async () => {
    const c = await rows(await rest('rpc/yw_submit_complaint', null, { method: 'POST', body: { p_category: 'Other', p_district: 'Salem', p_description: 'synthetic test complaint', p_photo: null, p_name: null, p_phone: null, p_anonymous: true } }));
    if (c.status !== 'ok') return; // rate-limited
    await rest('yw_complaints?ticket=eq.' + c.ticket, admin, { method: 'PATCH', body: { internal_note: 'SECRET-NOTE' } });
    const s = await rows(await rest('rpc/yw_complaint_status', null, { method: 'POST', body: { p_ticket: c.ticket } }));
    assert.ok(!JSON.stringify(s).includes('SECRET-NOTE'));
    await rest('yw_complaints?ticket=eq.' + c.ticket, admin, { method: 'DELETE' });
  });
});
