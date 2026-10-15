// Admin session + REST client. Injectable fetch/storage/clock for tests.
// Security model: the browser only ever holds the PUBLIC anon key and the admin's own JWT.
// Every request is authorised by Postgres RLS (yw_is_admin()), so tampering with anything here cannot grant access.

const SKEW = 60;              // refresh 60 s before expiry
const IDLE_MS = 30 * 60000;   // auto sign-out after 30 min idle
const MAX_FAILS = 5, LOCK_MS = 60000;

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

  async function signIn(email, password) {
    const lock = JSON.parse(storage.getItem('yw_admin_lock') || '{"n":0,"until":0}');
    if (lock.until > now()) throw new Error('Too many attempts. Try again in ' + Math.ceil((lock.until - now()) / 1000) + ' s.');
    try {
      const j = await authCall('token?grant_type=password', { email: String(email).trim(), password });
      save(fromAuth(j)); lastActive = now();
      storage.removeItem('yw_admin_lock');
    } catch (e) {
      lock.n++; if (lock.n >= MAX_FAILS) { lock.until = now() + LOCK_MS; lock.n = 0; }
      storage.setItem('yw_admin_lock', JSON.stringify(lock));
      throw new Error('Sign-in failed. Check your email and password.'); // generic: no account enumeration
    }
    if (!(await isAdmin())) { await signOut(); throw new Error('This account is not authorised as an administrator. Add your user to yw_admins table in Supabase.'); }
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
      // Surface setup errors clearly
      if (e.message && e.message.includes('404')) throw new Error('Database setup incomplete: run yw_features.sql in Supabase SQL Editor first.');
      if (e.message && (e.message.includes('yw_am_admin') || e.message.includes('does not exist'))) throw new Error('Database setup incomplete: run yw_features.sql in Supabase SQL Editor first.');
      return false;
    }
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
    signIn, signOut, isAdmin, req, rpc, page, withRange, upload, signedUrl, publicUrl,
    get email() { return session && session.email; },
    get signedIn() { return !!session; },
    touch() { lastActive = now(); },
    set onLogout(fn) { onLogout = fn; }
  };
}
