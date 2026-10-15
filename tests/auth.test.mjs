import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../admin/api.mjs';

// Fake Supabase: issues opaque tokens, enforces "admin only" like RLS would. Proves the CLIENT behaves
// correctly (refresh, expiry, lockout, sign-out, no privilege from client state). Real RLS is tested by rls.live.test.mjs.
function fakeSupabase(clock) {
  const users = { 'admin@yw.in': { pw: 'Admin#2026', admin: true }, 'member@yw.in': { pw: 'Member#2026', admin: false } };
  const tokens = new Map(); let n = 0; const log = [];
  const issue = email => { const a = 'at' + (++n), r = 'rt' + n; tokens.set(a, { email, exp: clock.t / 1000 + 3600 }); tokens.set(r, { email, refresh: true }); return { access_token: a, refresh_token: r, expires_in: 3600, user: { email } }; };
  const res = (status, body, headers = {}) => ({ ok: status < 300, status, text: async () => JSON.stringify(body), json: async () => body, headers: { get: k => headers[k.toLowerCase()] } });
  const fetch = async (url, o) => {
    const u = new URL(url), body = o.body ? JSON.parse(o.body) : {}; log.push(u.pathname + u.search);
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
      const usr = users[body.email]; return usr && usr.pw === body.password ? res(200, issue(body.email)) : res(400, { error_description: 'Invalid login credentials' });
    }
    if (u.pathname === '/auth/v1/token') { const t = tokens.get(body.refresh_token); if (!t || !t.refresh) return res(400, {}); tokens.delete(body.refresh_token); return res(200, issue(t.email)); }
    if (u.pathname === '/auth/v1/logout') { tokens.delete((o.headers.Authorization || '').slice(7)); return res(204, {}); }
    const t = tokens.get((o.headers.Authorization || '').slice(7));
    if (!t || t.refresh || t.exp < clock.t / 1000) return res(401, { message: 'JWT expired' });
    const admin = users[t.email].admin;
    if (u.pathname === '/rest/v1/rpc/yw_am_admin') return res(200, admin);
    if (u.pathname === '/rest/v1/yw_admin_members') return res(200, admin ? [{ id: 1, name: 'X' }] : [], { 'content-range': admin ? '0-0/1' : '*/0' });
    return res(404, {});
  };
  return { fetch, tokens, log };
}
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const setup = () => { const clock = { t: Date.UTC(2026, 9, 15) }, sb = fakeSupabase(clock), storage = mem();
  const c = createClient({ url: 'https://x.supabase.co', anonKey: 'anon', fetch: sb.fetch, storage, now: () => clock.t }); return { c, clock, sb, storage }; };

test('admin can sign in and read admin data', async () => {
  const { c } = setup();
  assert.equal(await c.signIn('admin@yw.in', 'Admin#2026'), 'admin@yw.in');
  const p = await c.page('yw_admin_members?select=*', 0, 25);
  assert.equal(p.total, 1);
});

test('ordinary user is rejected and signed out immediately', async () => {
  const { c, storage } = setup();
  await assert.rejects(c.signIn('member@yw.in', 'Member#2026'), /not authori[sz]ed as an administrator/);
  assert.equal(c.signedIn, false);
  assert.equal(storage.getItem('yw_admin_session'), null);
});

test('unauthenticated calls are refused before reaching the API', async () => {
  const { c, sb } = setup();
  await assert.rejects(c.req('yw_admin_members'), /Not signed in/);
  assert.ok(!sb.log.some(l => l.startsWith('/rest/')));
});

test('forged session in storage grants nothing', async () => {
  const { c, storage, sb } = setup();
  storage.setItem('yw_admin_session', JSON.stringify({ access_token: 'forged.role=admin', refresh_token: 'nope', expires_at: 9e9, email: 'admin@yw.in' }));
  const c2 = createClient({ url: 'https://x.supabase.co', anonKey: 'anon', fetch: sb.fetch, storage, now: () => Date.UTC(2026, 9, 15) });
  await assert.rejects(c2.req('yw_admin_members'), /expired/);
  assert.equal(c2.signedIn, false);
  void c;
});

test('wrong password gives a generic error and locks after 5 tries', async () => {
  const { c } = setup();
  for (let i = 0; i < 5; i++) await assert.rejects(c.signIn('admin@yw.in', 'bad'), /Sign-in failed/);
  await assert.rejects(c.signIn('admin@yw.in', 'Admin#2026'), /Too many attempts/);
  await assert.rejects(c.signIn('nobody@yw.in', 'x').catch(e => { throw e; }), /Too many|Sign-in failed/);
});

test('access token is refreshed silently before expiry', async () => {
  const { c, clock, sb } = setup();
  await c.signIn('admin@yw.in', 'Admin#2026');
  clock.t += 3590 * 1000; c.touch();
  await c.page('yw_admin_members?select=*', 0, 25);
  assert.ok(sb.log.some(l => l.includes('grant_type=refresh_token')));
});

test('revoked/expired refresh token forces sign-out', async () => {
  const { c, clock, sb } = setup();
  let reason = ''; c.onLogout = r => { reason = r; };
  await c.signIn('admin@yw.in', 'Admin#2026');
  for (const [k, v] of sb.tokens) if (v.refresh) sb.tokens.delete(k);
  clock.t += 3700 * 1000; c.touch();
  await assert.rejects(c.req('yw_admin_members'), /expired/);
  assert.equal(c.signedIn, false); assert.match(reason, /expired/);
});

test('idle timeout signs the admin out', async () => {
  const { c, clock } = setup();
  await c.signIn('admin@yw.in', 'Admin#2026');
  clock.t += 31 * 60000;
  await assert.rejects(c.req('yw_admin_members'), /expired/);
  assert.equal(c.signedIn, false);
});

test('sign-out revokes the token server-side', async () => {
  const { c, sb } = setup();
  await c.signIn('admin@yw.in', 'Admin#2026');
  const before = [...sb.tokens.keys()].filter(k => k.startsWith('at')).length;
  await c.signOut();
  assert.equal([...sb.tokens.keys()].filter(k => k.startsWith('at')).length, before - 1);
  assert.ok(sb.log.includes('/auth/v1/logout'));
});
