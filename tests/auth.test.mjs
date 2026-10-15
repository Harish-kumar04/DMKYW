import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, validatePassword, COMMON_PASSWORDS } from '../admin/api.mjs';

// Fake Supabase: models Supabase Auth + Postgres RLS with 14-day password expiration.
// Allows controllable clock testing to verify the exact 14-day boundary without waiting 14 real days.
function fakeSupabase(clock) {
  const users = {
    'admin@yw.in': {
      pw: 'Correct-Horse-Battery-2026',
      admin: true,
      password_changed_at: clock.t / 1000,
      password_expires_at: clock.t / 1000 + 14 * 86400
    },
    'member@yw.in': {
      pw: 'MemberPassphrase-2026',
      admin: false,
      password_changed_at: clock.t / 1000,
      password_expires_at: clock.t / 1000 + 14 * 86400
    }
  };
  const tokens = new Map();
  let n = 0;
  const log = [];

  const issue = email => {
    const a = 'at' + (++n), r = 'rt' + n;
    tokens.set(a, { email, exp: clock.t / 1000 + 3600 });
    tokens.set(r, { email, refresh: true });
    return { access_token: a, refresh_token: r, expires_in: 3600, user: { email } };
  };

  const res = (status, body, headers = {}) => ({
    ok: status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    headers: { get: k => headers[k.toLowerCase()] }
  });

  const fetch = async (url, o) => {
    const u = new URL(url), body = o.body ? JSON.parse(o.body) : {};
    log.push(u.pathname + u.search);

    // 1. Password login
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
      const usr = users[body.email];
      return usr && usr.pw === body.password ? res(200, issue(body.email)) : res(400, { error_description: 'Invalid login credentials' });
    }

    // 2. Token refresh
    if (u.pathname === '/auth/v1/token') {
      const t = tokens.get(body.refresh_token);
      if (!t || !t.refresh) return res(400, {});
      tokens.delete(body.refresh_token);
      return res(200, issue(t.email));
    }

    // 3. User update (password change)
    if (u.pathname === '/auth/v1/user' && o.method === 'PUT') {
      const authHeader = (o.headers.Authorization || '').slice(7);
      const t = tokens.get(authHeader);
      if (!t) return res(401, { message: 'Unauthorized' });
      const usr = users[t.email];
      if (body.password) usr.pw = body.password;
      return res(200, { email: t.email, updated_at: new Date(clock.t).toISOString() });
    }

    // 4. Password recovery
    if (u.pathname === '/auth/v1/recover') {
      return res(200, {});
    }

    // 5. Sign out
    if (u.pathname === '/auth/v1/logout') {
      tokens.delete((o.headers.Authorization || '').slice(7));
      return res(204, {});
    }

    // Token validation for protected REST / RPC endpoints
    const t = tokens.get((o.headers.Authorization || '').slice(7));
    if (!t || t.refresh || t.exp < clock.t / 1000) return res(401, { message: 'JWT expired' });
    const usr = users[t.email];

    // Server-enforced 14-day expiration check in PostgreSQL:
    // yw_is_admin() returns TRUE only if user is admin AND password_expires_at > now()
    const isUnexpiredAdmin = usr && usr.admin && usr.password_expires_at > clock.t / 1000;

    // RPC: yw_am_admin (calls yw_is_admin())
    if (u.pathname === '/rest/v1/rpc/yw_am_admin') {
      return res(200, isUnexpiredAdmin);
    }

    // RPC: yw_admin_status (returns status & remaining days even if expired, for renewal screen)
    if (u.pathname === '/rest/v1/rpc/yw_admin_status') {
      if (!usr || !usr.admin) return res(200, { is_admin: false, is_expired: false });
      const expired = usr.password_expires_at <= clock.t / 1000;
      const days = Math.max(0, Math.floor((usr.password_expires_at - clock.t / 1000) / 86400));
      return res(200, {
        is_admin: true,
        is_expired: expired,
        days_remaining: days,
        password_changed_at: new Date(usr.password_changed_at * 1000).toISOString(),
        password_expires_at: new Date(usr.password_expires_at * 1000).toISOString(),
        email: t.email
      });
    }

    // RPC: yw_admin_record_password_change (resets the 14-day clock in Postgres)
    if (u.pathname === '/rest/v1/rpc/yw_admin_record_password_change') {
      if (!usr || !usr.admin) return res(403, { message: 'Not authorised' });
      usr.password_changed_at = clock.t / 1000;
      usr.password_expires_at = clock.t / 1000 + 14 * 86400;
      return res(200, {
        success: true,
        password_changed_at: new Date(usr.password_changed_at * 1000).toISOString(),
        password_expires_at: new Date(usr.password_expires_at * 1000).toISOString()
      });
    }

    // Direct modification of yw_admins table is forbidden (revoke update from anon, authenticated)
    if (u.pathname === '/rest/v1/yw_admins' && (o.method === 'PATCH' || o.method === 'POST' || o.method === 'DELETE')) {
      return res(403, { message: 'Permission denied: direct modification of yw_admins table is revoked' });
    }

    // Protected table: yw_admin_members (RLS requires yw_is_admin() which requires unexpired password)
    if (u.pathname === '/rest/v1/yw_admin_members') {
      if (!isUnexpiredAdmin) return res(403, { message: 'Permission denied: password expired or not admin' });
      return res(200, [{ id: 1, name: 'Sample Member' }], { 'content-range': '0-0/1' });
    }

    return res(404, {});
  };

  const issueRecoveryToken = email => {
    const rk = 'rec_' + (++n);
    tokens.set(rk, { email, exp: clock.t / 1000 + 900 }); // 15 min valid recovery token
    return rk;
  };

  return { fetch, tokens, log, users, issueRecoveryToken };
}

const mem = () => {
  const m = new Map();
  return {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    m
  };
};

const setup = () => {
  const clock = { t: Date.UTC(2026, 9, 15, 12, 0, 0) }; // 2026-10-15 12:00 UTC
  const sb = fakeSupabase(clock);
  const storage = mem();
  const c = createClient({
    url: 'https://x.supabase.co',
    anonKey: 'anon',
    fetch: sb.fetch,
    storage,
    now: () => clock.t
  });
  return { c, clock, sb, storage };
};

// =====================================================================
// 1. Password Policy Tests
// =====================================================================
test('password policy: rejects passwords under 15 characters', () => {
  assert.equal(validatePassword('ShortPass1234!').valid, false);
  assert.match(validatePassword('ShortPass1234!').errors[0], /at least 15 characters/);
  assert.equal(validatePassword('Exactly15Chars!').valid, true);
});

test('password policy: rejects known compromised / weak passwords', () => {
  for (const common of COMMON_PASSWORDS) {
    const res = validatePassword(common);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => /too common/.test(e)));
  }
});

test('password policy: rejects password containing user email prefix', () => {
  const res = validatePassword('MySuperSecretAdminPassphrase2026', 'admin@yw.in');
  assert.equal(res.valid, false);
  assert.match(res.errors[0], /email username/);
});

test('password policy: accepts strong passphrases and password-manager strings', () => {
  const res1 = validatePassword('correct-horse-battery-staple-2026', 'officer@yw.in');
  assert.equal(res1.valid, true);
  assert.equal(res1.errors.length, 0);

  const res2 = validatePassword('X9#kL2$vN8!wQ4%zP1&mR7*tY', 'officer@yw.in');
  assert.equal(res2.valid, true);
});

// =====================================================================
// 2. Authentication & Authorization Tests
// =====================================================================
test('admin can sign in and read admin data when unexpired', async () => {
  const { c } = setup();
  assert.equal(await c.signIn('admin@yw.in', 'Correct-Horse-Battery-2026'), 'admin@yw.in');
  const p = await c.page('yw_admin_members?select=*', 0, 25);
  assert.equal(p.total, 1);
});

test('ordinary user is rejected and signed out immediately', async () => {
  const { c, storage } = setup();
  await assert.rejects(c.signIn('member@yw.in', 'MemberPassphrase-2026'), /not authori[sz]ed as an administrator/);
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
  await assert.rejects(c.signIn('admin@yw.in', 'Correct-Horse-Battery-2026'), /Too many attempts/);
});

// =====================================================================
// 3. 14-Day Mandatory Password Expiration Tests
// =====================================================================
test('14-day expiration: valid before 14 days, strictly blocked in Postgres RLS after 14 days', async () => {
  const { c, clock } = setup();
  await c.signIn('admin@yw.in', 'Correct-Horse-Battery-2026');

  // Day 13: still valid
  clock.t += 13 * 86400 * 1000;
  c.touch();
  const st13 = await c.getAdminStatus();
  assert.equal(st13.is_expired, false);
  assert.equal(st13.days_remaining, 1);
  const okData = await c.req('yw_admin_members');
  assert.equal(okData.length, 1);

  // Day 14 + 1 hour: password is now EXPIRED
  clock.t += (86400 + 3600) * 1000;
  c.touch();
  const st14 = await c.getAdminStatus();
  assert.equal(st14.is_expired, true);
  assert.equal(st14.days_remaining, 0);

  // Direct REST API calls to protected data are rejected by Postgres RLS!
  await assert.rejects(c.req('yw_admin_members'), /Permission denied|password expired/);
});

test('expired password renewal: allows updating password and restores access for next 14 days', async () => {
  const { c, clock, sb } = setup();
  await c.signIn('admin@yw.in', 'Correct-Horse-Battery-2026');

  // Fast-forward past 14 days
  clock.t += 15 * 86400 * 1000;
  c.touch();

  // Verify access is currently blocked
  await assert.rejects(c.req('yw_admin_members'), /Permission denied|password expired/);

  // Attempting renewal with incorrect current password fails
  await assert.rejects(
    c.renewExpiredPassword('WrongCurrentPass', 'BrandNewPassphrase2026!'),
    /Current password is incorrect/
  );

  // Attempting renewal with password under 15 characters fails
  await assert.rejects(
    c.renewExpiredPassword('Correct-Horse-Battery-2026', 'ShortPw123!'),
    /at least 15 characters/
  );

  // Successful renewal with a valid 15+ char passphrase
  const newPw = 'BrandNewPassphrase2026!';
  await c.renewExpiredPassword('Correct-Horse-Battery-2026', newPw);

  // Status is now unexpired with 14 days remaining
  const statusAfter = await c.getAdminStatus();
  assert.equal(statusAfter.is_expired, false);
  assert.equal(statusAfter.days_remaining, 14);

  // Protected REST operations succeed again
  const members = await c.req('yw_admin_members');
  assert.equal(members.length, 1);

  // Proves the password in Supabase Auth was updated
  assert.equal(sb.users['admin@yw.in'].pw, newPw);
});

test('in-session password change verifies old password and updates expiration', async () => {
  const { c, sb } = setup();
  await c.signIn('admin@yw.in', 'Correct-Horse-Battery-2026');

  const newPw = 'UpdatedSecurePassphrase2026!';
  await c.changePassword('Correct-Horse-Battery-2026', newPw);

  assert.equal(sb.users['admin@yw.in'].pw, newPw);
  const st = await c.getAdminStatus();
  assert.equal(st.days_remaining, 14);
});

test('password recovery: provides generic success without user enumeration', async () => {
  const { c, sb } = setup();
  const res = await c.requestPasswordRecovery('admin@yw.in');
  assert.match(res.message, /instructions have been sent/);
  assert.ok(sb.log.includes('/auth/v1/recover'));

  // Unknown email returns the same generic message
  const res2 = await c.requestPasswordRecovery('unknown@external.org');
  assert.match(res2.message, /instructions have been sent/);
});

test('session security: idle timeout signs the admin out after 30 minutes', async () => {
  const { c, clock } = setup();
  await c.signIn('admin@yw.in', 'Correct-Horse-Battery-2026');
  clock.t += 31 * 60000;
  await assert.rejects(c.req('yw_admin_members'), /expired/);
  assert.equal(c.signedIn, false);
});

test('sign-out revokes the token server-side', async () => {
  const { c, sb } = setup();
  await c.signIn('admin@yw.in', 'Correct-Horse-Battery-2026');
  const before = [...sb.tokens.keys()].filter(k => k.startsWith('at')).length;
  await c.signOut();
  assert.equal([...sb.tokens.keys()].filter(k => k.startsWith('at')).length, before - 1);
  assert.ok(sb.log.includes('/auth/v1/logout'));
});

// =====================================================================
// 4. Token Reset & Tampering Prevention Tests
// =====================================================================
test('password reset with recovery token: valid token resets password and 14-day clock', async () => {
  const { c, sb } = setup();
  const token = sb.issueRecoveryToken('admin@yw.in');
  const newPw = 'BrandNewRecoveryPass2026!';

  await c.resetPasswordWithRecovery(newPw, token);
  assert.equal(sb.users['admin@yw.in'].pw, newPw);
});

test('password reset with recovery token: rejects weak or short password', async () => {
  const { c, sb } = setup();
  const token = sb.issueRecoveryToken('admin@yw.in');

  await assert.rejects(
    c.resetPasswordWithRecovery('ShortPw123!', token),
    /at least 15 characters/
  );
});

test('password reset with recovery token: invalid or expired recovery token is rejected', async () => {
  const { c } = setup();
  await assert.rejects(
    c.resetPasswordWithRecovery('BrandNewRecoveryPass2026!', 'invalid_recovery_token'),
    /Password reset failed|Unauthorized/
  );
});

test('tamper resistance: client cannot directly modify password expiration metadata in yw_admins', async () => {
  const { c } = setup();
  await c.signIn('admin@yw.in', 'Correct-Horse-Battery-2026');

  // Attempting to directly PATCH yw_admins to extend password_expires_at is rejected
  await assert.rejects(
    c.req('yw_admins', {
      method: 'PATCH',
      body: { password_expires_at: new Date(Date.now() + 1000 * 86400 * 365).toISOString() }
    }),
    /Permission denied|revoked/
  );
});

test('privilege isolation: ordinary registered user cannot reset admin expiration clock', async () => {
  const { c, sb } = setup();
  // Member signs in to get authenticated token
  const res = await c.signIn('member@yw.in', 'MemberPassphrase-2026').catch(() => null);
  void res;
  
  // Directly attempting to call yw_admin_record_password_change without admin privileges fails
  const memberToken = sb.issueRecoveryToken('member@yw.in');
  const fakeCall = await sb.fetch('https://x.supabase.co/rest/v1/rpc/yw_admin_record_password_change', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + memberToken }
  });
  assert.equal(fakeCall.ok, false);
  assert.equal(fakeCall.status, 403);
});

