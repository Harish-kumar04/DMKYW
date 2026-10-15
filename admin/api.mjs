// Admin session + REST client. Injectable fetch/storage/clock for tests.
// Security model: the browser only ever holds the PUBLIC anon key and the admin's own JWT.
// Every request is authorised by Postgres RLS (yw_is_admin()), so tampering with anything here cannot grant access.

const SKEW = 60;              // refresh 60 s before expiry
const IDLE_MS = 30 * 60000;   // auto sign-out after 30 min idle
const MAX_FAILS = 5, LOCK_MS = 60000;

export const COMMON_PASSWORDS = new Set([
  'password1234567',
  'administrator123',
  'adminadminadmin',
  'youthwingadmin1',
  'youthwing2026!',
  'changeme1234567',
  'dmkyouthwing2026',
  'qwertyuiop12345',
  '123456789012345',
  'welcome12345678',
  'letmein12345678',
  'iloveyou1234567'
]);

export function validatePassword(password, email = '') {
  const p = String(password || '');
  const errors = [];
  if (p.length < 15) {
    errors.push('Password must be at least 15 characters long.');
  }
  const low = p.toLowerCase();
  if (COMMON_PASSWORDS.has(low)) {
    errors.push('This password is too common and easily guessed.');
  }
  if (email) {
    const handle = email.split('@')[0].toLowerCase().trim();
    if (handle.length >= 3 && low.includes(handle)) {
      errors.push('Password cannot contain your email username.');
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

export function createClient({ url, anonKey, fetch: f = globalThis.fetch.bind(globalThis), storage, now = () => Date.now() }) {
  const base = url.replace(/\/+$/, '');
  const K = 'yw_admin_session';
  let session = null, lastActive = now(), onLogout = () => {};
  try { session = JSON.parse(storage.getItem(K) || 'null'); } catch { session = null; }

  const save = s => { session = s; s ? storage.setItem(K, JSON.stringify(s)) : storage.removeItem(K); };
  const fromAuth = j => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(now() / 1000) + (j.expires_in || 3600), email: j.user && j.user.email });

  async function authCall(path, body, token) {
    const r = await f(base + '/auth/v1/' + path, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
    const t = await r.text(); let j = {}; try { j = t ? JSON.parse(t) : {}; } catch {}
    if (!r.ok) throw Object.assign(new Error(j.error_description || j.msg || j.message || 'Authentication failed'), { status: r.status });
    return j;
  }

  async function getAdminStatus() {
    try {
      const s = await rpc('yw_admin_status');
      if (s && typeof s === 'object') return s;
    } catch { /* fallback to am_admin check */ }
    const admin = await isAdmin();
    return { is_admin: admin, is_expired: false, days_remaining: 14 };
  }

  async function signIn(email, password) {
    const lock = JSON.parse(storage.getItem('yw_admin_lock') || '{"n":0,"until":0}');
    if (lock.until > now()) throw new Error('Too many attempts. Try again in ' + Math.ceil((lock.until - now()) / 1000) + ' s.');
    try {
      const j = await authCall('token?grant_type=password', { email: String(email).trim(), password });
      save(fromAuth(j)); lastActive = now();
      storage.removeItem('yw_admin_lock');
    } catch (e) {
      console.warn('[Admin Auth Failure]', e.message || e);
      lock.n++; if (lock.n >= MAX_FAILS) { lock.until = now() + LOCK_MS; lock.n = 0; }
      storage.setItem('yw_admin_lock', JSON.stringify(lock));
      if (e.message && e.message.toLowerCase().includes('confirm')) {
        throw new Error('Email not confirmed. In Supabase Dashboard > Authentication > Users, verify or auto-confirm this user.');
      }
      throw new Error('Sign-in failed. Check your email and password.'); // generic: no account enumeration
    }
    const status = await getAdminStatus();
    if (!status.is_admin) {
      await signOut();
      throw new Error('This account is not authorised as an administrator. Add your user to yw_admins table in Supabase.');
    }
    return session.email;
  }

  async function token() {
    if (!session) throw Object.assign(new Error('Not signed in'), { status: 401 });
    if (now() - lastActive > IDLE_MS) { await signOut('Signed out after 30 minutes of inactivity.'); throw Object.assign(new Error('Session expired'), { status: 401 }); }
    if (session.expires_at - SKEW <= now() / 1000) {
      try { save(fromAuth(await authCall('token?grant_type=refresh_token', { refresh_token: session.refresh_token }))); }
      catch { await signOut('Your session expired. Please sign in again.'); throw Object.assign(new Error('Session expired'), { status: 401 }); }
    }
    return session.access_token;
  }

  async function signOut(reason) {
    const s = session; save(null);
    if (s) { try { await authCall('logout', {}, s.access_token); } catch {} }
    onLogout(reason || '');
  }

  async function req(path, { method = 'GET', body, headers = {}, raw = false } = {}, retried = false) {
    const tk = await token();
    lastActive = now();
    const r = await f(base + '/rest/v1/' + path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { apikey: anonKey, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', ...headers } });
    if (r.status === 401 && !retried) { session.expires_at = 0; return req(path, { method, body, headers, raw }, true); }
    if (r.status === 401) { await signOut('Your session expired. Please sign in again.'); throw Object.assign(new Error('Session expired'), { status: 401 }); }
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
    if (!r.ok) throw Object.assign(new Error((j && (j.message || j.hint)) || 'Request failed (' + r.status + ')'), { status: r.status });
    return raw ? { data: j, headers: r.headers } : j;
  }

  const rpc = (fn, args) => req('rpc/' + fn, { method: 'POST', body: args || {} });

  async function isAdmin() {
    try { return (await rpc('yw_am_admin')) === true; }
    catch (e) {
      if (e.message && e.message.includes('404')) throw new Error('Database setup incomplete: run yw_features.sql in Supabase SQL Editor first.');
      if (e.message && (e.message.includes('yw_am_admin') || e.message.includes('does not exist'))) throw new Error('Database setup incomplete: run yw_features.sql in Supabase SQL Editor first.');
      return false;
    }
  }

  async function changePassword(currentPassword, newPassword) {
    if (!session) throw Object.assign(new Error('Not signed in'), { status: 401 });
    const v = validatePassword(newPassword, session.email);
    if (!v.valid) throw new Error(v.errors.join(' '));

    // 1. Verify current password
    try {
      await authCall('token?grant_type=password', { email: session.email, password: currentPassword });
    } catch {
      throw new Error('Current password is incorrect.');
    }

    // 2. Update password in Supabase Auth
    const tk = await token();
    const r = await f(base + '/auth/v1/user', {
      method: 'PUT',
      headers: { apikey: anonKey, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
    const t = await r.text(); let j = {}; try { j = t ? JSON.parse(t) : {}; } catch {}
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || 'Failed to update password');

    // 3. Record change in Postgres (resets 14-day clock and writes to audit log)
    const status = await rpc('yw_admin_record_password_change');
    return status;
  }

  async function renewExpiredPassword(currentPassword, newPassword) {
    return changePassword(currentPassword, newPassword);
  }

  async function requestPasswordRecovery(email) {
    const e = String(email || '').trim();
    if (!e || !e.includes('@')) throw new Error('Please enter a valid email address.');
    try {
      await authCall('recover', { email: e });
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('rate limit')) throw err;
    }
    // Anti-enumeration: uniform message regardless of whether the email exists
    return { message: 'If an administrative account exists for this email, password reset instructions have been sent.' };
  }

  async function resetPasswordWithRecovery(newPassword, recoveryToken) {
    const v = validatePassword(newPassword);
    if (!v.valid) throw new Error(v.errors.join(' '));

    const r = await f(base + '/auth/v1/user', {
      method: 'PUT',
      headers: { apikey: anonKey, Authorization: 'Bearer ' + recoveryToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
    const t = await r.text(); let j = {}; try { j = t ? JSON.parse(t) : {}; } catch {}
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || 'Password reset failed');

    // Update password expiration record in Postgres
    await f(base + '/rest/v1/rpc/yw_admin_record_password_change', {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: 'Bearer ' + recoveryToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return { success: true };
  }

  /** One page + exact total count (server-side pagination). */
  async function page(path, from, size) {
    const { data, headers } = await req(path, { headers: { Prefer: 'count=exact', 'Range-Unit': 'items', Range: `${from}-${from + size - 1}` }, raw: true });
    const cr = headers.get('content-range') || '', total = +(cr.split('/')[1] || 0);
    return { rows: data || [], total: isNaN(total) ? (data || []).length : total };
  }
  const withRange = (path, off, lim) => path + (path.includes('?') ? '&' : '?') + `offset=${off}&limit=${lim}`;

  async function upload(bucket, path, blob, type) {
    const r = await f(`${base}/storage/v1/object/${bucket}/${path}`, { method: 'POST', body: blob, headers: { apikey: anonKey, Authorization: 'Bearer ' + await token(), 'Content-Type': type } });
    if (!r.ok) throw new Error('Upload failed');
    return path;
  }
  async function signedUrl(bucket, path, expiresIn = 300) {
    const r = await f(`${base}/storage/v1/object/sign/${bucket}/${path}`, { method: 'POST', headers: { apikey: anonKey, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.message || 'Could not open file');
    return base + '/storage/v1' + j.signedURL;
  }
  const publicUrl = (bucket, path) => `${base}/storage/v1/object/public/${bucket}/${path}`;

  return {
    signIn, signOut, isAdmin, getAdminStatus, changePassword, renewExpiredPassword,
    requestPasswordRecovery, resetPasswordWithRecovery,
    req, rpc, page, withRange, upload, signedUrl, publicUrl,
    get email() { return session && session.email; },
    get signedIn() { return !!session; },
    touch() { lastActive = now(); },
    set onLogout(fn) { onLogout = fn; }
  };
}
