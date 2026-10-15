// DMK YouthWing admin console. Vanilla ES modules, no build step.
import { createClient } from './api.mjs';
import { DATASETS, DISTRICTS, buildQuery, fetchAll, exportFilename, cleanSearch } from './query.mjs';
import { toCSV, toXLSX, prepareRows, maskContact } from './export.mjs';
import baseCfg from './config.mjs';

let cfg = baseCfg;
try { cfg = (await import('./config.local.mjs')).default; } catch { /* no local override */ }

const api = createClient({ url: cfg.url, anonKey: cfg.anonKey, storage: sessionStorage });

// ---------- tiny helpers ----------
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => { try { const x = new URL(String(u || '').trim()); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const fdate = (d, t) => d ? new Date(d).toLocaleString('en-IN', t ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const opts = (arr, sel, ph) => (ph != null ? `<option value="">${esc(ph)}</option>` : '') + arr.map(a => { const [v, l] = Array.isArray(a) ? a : [a, a]; return `<option value="${esc(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
const chip = (v, cls) => `<span class="chip ${esc(cls ?? v)}">${esc(v)}</span>`;
const yes = b => b ? chip('Yes', 'yes') : chip('No', 'no');
const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const ytId = u => ((u || '').match(/(?:youtu\.be\/|[?&]v=|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/) || [])[1] || '';
const eq = v => 'eq.' + encodeURIComponent(v);
const V = $('#view');
const skeleton = n => `<div class="tbl-wrap"><table><tbody>${Array.from({ length: n }, () => '<tr><td><div class="skel"></div></td><td><div class="skel"></div></td><td><div class="skel"></div></td></tr>').join('')}</tbody></table></div>`;
const failBox = e => `<div class="empty">⚠️ ${esc(e.message || 'Something went wrong')}</div>`;
function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.className = 'toast', 2800); }
const confirmTyped = (what) => prompt(`Type DELETE to permanently delete ${what}.`) === 'DELETE';
function drawer(html) { $('#dw').innerHTML = html; const d = $('#drawer'); if (!d.open) d.showModal(); return $('#dw'); }
$('#drawer').addEventListener('click', e => { if (e.target.id === 'drawer') e.target.close(); });
const pager = (st, total, size) => { const pages = Math.max(1, Math.ceil(total / size)); return `<div class="pager"><span class="muted small">${total.toLocaleString('en-IN')} record${total === 1 ? '' : 's'} · page ${st.page + 1} of ${pages}</span><span class="row"><button class="btn ghost sm" data-pg="-1"${st.page ? '' : ' disabled'}>← Prev</button><button class="btn ghost sm" data-pg="1"${st.page + 1 < pages ? '' : ' disabled'}>Next →</button></span></div>`; };
function bindPager(root, st, reload) { $$('[data-pg]', root).forEach(b => b.onclick = () => { st.page += +b.dataset.pg; reload(); }); }
function download(bytes, name, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

async function compress(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Only JPG, PNG or WebP images.');
  const bmp = await createImageBitmap(file), sc = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [.82, .65, .5]) { const b = await new Promise(r => c.toBlob(r, 'image/webp', q)); if (b && b.size <= 2097152) return b; }
  throw new Error('Image is too large even after compression (max 2 MB).');
}

// ---------- shell ----------
const NAV = [
  ['dashboard', '📊', 'Dashboard'], ['members', '👥', 'Members'], ['complaints', '📮', 'Complaints'], ['ideas', '💡', 'Ideas'],
  ['feeds', '📰', 'Feeds'], ['podcast', '🎙️', 'Podcast'], ['books', '📚', 'Bookshelf'], ['leaderboard', '🏆', 'Leaderboard'],
  ['inbox', '📥', 'Inbox'], ['activity', '🕑', 'Admin activity'], ['settings', '⚙️', 'Settings']
];
$('#nav').innerHTML = NAV.map(([k, i, l]) => `<a href="#/${k}" data-k="${k}"><span aria-hidden="true">${i}</span>${l}</a>`).join('');
$('#envb').textContent = cfg.env === 'production' ? 'Production database' : 'Development database';
$('#envb').classList.add(cfg.env === 'production' ? 'production' : 'development');
$('#menu').onclick = () => $('#side').classList.toggle('open');
$('#out').onclick = () => api.signOut('Signed out.');
['click', 'keydown'].forEach(ev => addEventListener(ev, () => api.touch(), { passive: true }));

api.onLogout = reason => { showLogin(reason); };

function showLogin(reason) {
  $('#app').hidden = true; $('#login').hidden = false; $('#drawer').open && $('#drawer').close();
  const m = $('#lm'); m.className = 'msg' + (reason ? ' bad' : ''); m.textContent = reason || '';
  $('#le').focus();
}
$('#lf').onsubmit = async e => {
  e.preventDefault(); const b = $('#lb'), m = $('#lm');
  if (!$('#le').value || !$('#lp').value) { m.className = 'msg bad'; m.textContent = 'Enter email and password.'; return; }
  b.disabled = true; m.className = 'msg'; m.textContent = 'Signing in…';
  try { await api.signIn($('#le').value, $('#lp').value); $('#lp').value = ''; start(); }
  catch (err) { m.className = 'msg bad'; m.textContent = err.message; }
  b.disabled = false;
};

function start() { $('#login').hidden = true; $('#app').hidden = false; $('#who').textContent = api.email || ''; route(); }

const VIEWS = {};
async function route() {
  if (!api.signedIn) return showLogin();
  const k = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'dashboard', view = VIEWS[k] ? k : 'dashboard';
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.k === view));
  $('#side').classList.remove('open');
  document.title = NAV.find(n => n[0] === view)[2] + ' | YW Admin';
  try { await VIEWS[view](); } catch (e) { if (e.status !== 401) V.innerHTML = failBox(e); }
}
addEventListener('hashchange', route);

// ---------- Dashboard ----------
VIEWS.dashboard = async () => {
  V.innerHTML = '<h1 class="pg">Dashboard</h1><p class="pg-sub">Live counts from the database.</p><div class="stats">' + '<div class="stat"><div class="skel"></div></div>'.repeat(8) + '</div>';
  const s = await api.rpc('yw_admin_stats');
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const card = (n, label, sub, href) => `<a class="stat" href="${href}" style="text-decoration:none"><b>${(+n || 0).toLocaleString('en-IN')}</b><span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</a>`;
  V.innerHTML = '<h1 class="pg">Dashboard</h1><p class="pg-sub">Live counts from the database.</p><div class="stats">' +
    card(s.members, 'Registered members', `+${s.members_30d} in last 30 days`, '#/members') +
    card(s.kit_requests, 'Kit requests', '', '#/members') +
    card(sum(s.complaints), 'Complaints', `${(s.complaints || {}).New || 0} new · ${(s.complaints || {})['In review'] || 0} in review`, '#/complaints') +
    card(sum(s.ideas), 'Ideas', `${(s.ideas || {}).Pending || 0} pending review`, '#/ideas') +
    card(s.feeds_published, 'Published feeds', `${s.feeds_draft} drafts`, '#/feeds') +
    card(s.episodes, 'Podcast episodes', '', '#/podcast') +
    card(s.books, 'Bookshelf entries', '', '#/books') +
    card(s.points_awarded, 'Points awarded', 'excluding reversed', '#/leaderboard') + '</div>' +
    '<h2>Top districts by members</h2><div class="tbl-wrap"><table><tr><th>District</th><th>Members</th></tr>' +
    ((s.top_districts || []).map(d => `<tr><td>${esc(d.district)}</td><td>${d.n}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">No members yet.</td></tr>') + '</table></div>';
};

// ---------- Generic data view (members / complaints / ideas) with filters + export ----------
const S = {};
function dataView(ds, { title, sub, head, row, detail }) {
  return async () => {
    const D = DATASETS[ds], st = S[ds] ||= { f: {}, sort: D.sorts[0], dir: 'desc', page: 0, size: 25 };
    const enumSel = k => D.filters[k] ? `<label>${k}<select data-f="${k}">${opts(D.enums[k], st.f[k], 'All')}</select></label>` : '';
    V.innerHTML = `<h1 class="pg">${title}</h1><p class="pg-sub">${sub}</p>
      <div class="bar">
        <label class="q">Search<input data-f="q" type="search" placeholder="Search…" value="${esc(st.f.q)}"></label>
        <label>District<select data-f="district">${opts(DISTRICTS, st.f.district, 'All')}</select></label>
        ${enumSel('category')}${enumSel('status')}
        ${D.filters.wants_kit ? `<label>Kit<select data-f="wants_kit">${opts([['true', 'Wants kit'], ['false', 'No kit']], st.f.wants_kit, 'All')}</select></label>` : ''}
        <label>From<input data-f="from" type="date" value="${esc(st.f.from)}"></label>
        <label>To<input data-f="to" type="date" value="${esc(st.f.to)}"></label>
        <label>Sort<select id="srt">${opts(D.sorts.map(s => [s, s.replace('_', ' ')]), st.sort)}</select></label>
        <label>Order<select id="dir">${opts([['desc', 'Newest / Z–A'], ['asc', 'Oldest / A–Z']], st.dir)}</select></label>
        <button class="btn ghost sm" id="rst" type="button">Reset</button>
      </div>
      <details class="exp"><summary>⬇️ Export ${title.toLowerCase()} (uses the filters above)</summary>
        <div class="cols">${D.columns.map(c => `<label><input type="checkbox" data-col="${c.key}" checked>${esc(c.label)}${c.pii ? ' 🔒' : ''}</label>`).join('')}</div>
        <div class="row"><label class="ck"><input type="checkbox" id="pii">Include personal data (🔒 columns unmasked; this is logged)</label><span class="grow"></span>
        <button class="btn dark sm" data-exp="xlsx" type="button">Export to Excel (.xlsx)</button><button class="btn ghost sm" data-exp="csv" type="button">Export CSV</button></div>
        <div class="msg" id="exm"></div>
      </details>
      <div id="tbl">${skeleton(6)}</div>`;
    const read = () => { const f = {}; $$('[data-f]', V).forEach(i => { if (i.value) f[i.dataset.f] = i.value; }); return f; };
    const load = async () => {
      const box = $('#tbl', V);
      try {
        const path = buildQuery(ds, st.f, { sort: st.sort, dir: st.dir });
        const { rows, total } = await api.page(path, st.page * st.size, st.size);
        if (st.page && !rows.length && total) { st.page = 0; return load(); }
        box.innerHTML = rows.length ? `<div class="tbl-wrap"><table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map((r, i) => `<tr class="click" data-i="${i}" tabindex="0">${row(r)}</tr>`).join('')}</table></div>${pager(st, total, st.size)}` : '<div class="tbl-wrap"><div class="empty">No records match these filters.</div></div>';
        $$('tr[data-i]', box).forEach(tr => { const open = () => detail(rows[+tr.dataset.i], load); tr.onclick = open; tr.onkeydown = e => { if (e.key === 'Enter') open(); }; });
        bindPager(box, st, load);
      } catch (e) { if (e.status !== 401) box.innerHTML = failBox(e); }
    };
    const apply = () => { try { const f = read(); buildQuery(ds, f); st.f = f; st.page = 0; load(); } catch (e) { toast(e.message, 1); } };
    $$('[data-f]', V).forEach(i => i.addEventListener(i.dataset.f === 'q' ? 'input' : 'change', i.dataset.f === 'q' ? debounce(apply) : apply));
    $('#srt', V).onchange = e => { st.sort = e.target.value; load(); };
    $('#dir', V).onchange = e => { st.dir = e.target.value; load(); };
    $('#rst', V).onclick = () => { S[ds] = null; VIEWS[ds](); };
    $$('[data-exp]', V).forEach(b => b.onclick = async () => {
      const fmt = b.dataset.exp, m = $('#exm', V), pii = $('#pii', V).checked;
      const cols = D.columns.filter(c => $(`[data-col="${c.key}"]`, V).checked);
      if (!cols.length) { m.className = 'msg bad'; m.textContent = 'Select at least one column.'; return; }
      if (pii && !confirm('Export will include unmasked personal data. Store the file securely and delete it when done. Continue?')) return;
      $$('[data-exp]', V).forEach(x => x.disabled = true); m.className = 'msg'; m.textContent = 'Preparing…';
      try {
        const path = buildQuery(ds, st.f, { sort: st.sort, dir: st.dir, columns: cols.map(c => c.key) });
        const rows = await fetchAll((o, l) => api.req(api.withRange(path, o, l)), { batch: 1000, cap: 50000, onProgress: n => m.textContent = `Fetched ${n.toLocaleString('en-IN')} rows…` });
        const matrix = prepareRows(rows, cols, { includePII: pii });
        const name = exportFilename(ds, fmt);
        if (fmt === 'csv') download(toCSV(cols, matrix), name, 'text/csv;charset=utf-8');
        else download(toXLSX(cols, matrix, title), name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await api.rpc('yw_admin_log_export', { p_dataset: ds, p_format: fmt, p_filters: st.f, p_rows: rows.length, p_pii: pii }).catch(() => {});
        m.className = 'msg good'; m.textContent = `Downloaded ${name} (${rows.length.toLocaleString('en-IN')} rows).`;
      } catch (e) { m.className = 'msg bad'; m.textContent = e.message; }
      $$('[data-exp]', V).forEach(x => x.disabled = false);
    });
    load();
  };
}

const kv = pairs => `<dl class="kv">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

VIEWS.members = dataView('members', {
  title: 'Members', sub: 'Registered YouthWing members. Contact details are masked in the list.',
  head: ['Member ID', 'Name', 'District', 'Contact', 'Kit', 'Joined'],
  row: r => `<td><b>${esc(r.member_id || '—')}</b></td><td>${esc(r.name)}</td><td>${esc(r.district)}</td><td>${esc(maskContact(r.contact))}</td><td>${yes(r.wants_kit)}</td><td>${fdate(r.created_at)}</td>`,
  detail: async (r, reload) => {
    const d = drawer(`<h2 style="margin:0">${esc(r.name)}</h2><p class="muted" style="margin:0">${esc(r.member_id || 'No member ID')}</p>` +
      kv([['District', esc(r.district)], ['Contact', `<span id="ct">${esc(maskContact(r.contact))}</span> <button class="btn ghost sm" id="rv" type="button">Reveal</button>`], ['Voter ID', 'xxxxxx' + esc(r.voter_last4 || '')], ['Joined', fdate(r.created_at, 1)], ['Points', '<span id="pts">…</span>']]) +
      `<form class="form" id="kf"><b>Kit delivery</b><label class="ck"><input type="checkbox" name="w"${r.wants_kit ? ' checked' : ''}>Wants kit</label>
       <div class="g2"><label>Size<select name="s">${opts(['S', 'M', 'L', 'XL', 'XXL'], r.kit_size, '—')}</select></label><label>Pincode<input name="p" inputmode="numeric" maxlength="6" value="${esc(r.kit_pincode)}"></label></div>
       <label>Address<input name="a" maxlength="300" value="${esc(r.kit_address)}"></label><div class="msg" id="km"></div>
       <div class="row"><button class="btn" type="submit">Save kit details</button><button class="btn ghost" type="button" id="cl">Close</button></div></form>`);
    $('#cl', d).onclick = () => $('#drawer').close();
    $('#rv', d).onclick = e => { $('#ct', d).textContent = r.contact; e.target.remove(); };
    if (r.member_id) api.req('yw_admin_member_points?member_id=' + eq(r.member_id) + '&select=points,week_points').then(p => { $('#pts', d).textContent = p[0] ? `${p[0].points} total · ${p[0].week_points} this week` : '0'; }).catch(() => { $('#pts', d).textContent = '—'; });
    else $('#pts', d).textContent = '—';
    $('#kf', d).onsubmit = async e => {
      e.preventDefault(); const f = e.target, m = $('#km', d);
      if (f.p.value && !/^\d{6}$/.test(f.p.value)) { m.className = 'msg bad'; m.textContent = 'Pincode must be 6 digits.'; return; }
      try { await api.req('yw_members?id=' + eq(r.id), { method: 'PATCH', body: { wants_kit: f.w.checked, kit_size: f.s.value || null, kit_address: f.a.value.trim() || null, kit_pincode: f.p.value || null }, headers: { Prefer: 'return=minimal' } }); toast('Saved'); $('#drawer').close(); reload(); }
      catch (err) { m.className = 'msg bad'; m.textContent = err.message; }
    };
  }
});

VIEWS.complaints = dataView('complaints', {
  title: 'Complaints', sub: 'Citizen complaints. The public reply is visible to the citizen through their ticket number; internal notes are private.',
  head: ['Ticket', 'Category', 'District', 'Complaint', 'Status', 'Submitted'],
  row: r => `<td><b>${esc(r.ticket)}</b></td><td>${esc(r.category)}</td><td>${esc(r.district)}</td><td><div class="clip">${esc(r.description)}</div></td><td>${chip(r.status, r.status.replace(' ', ''))}</td><td>${fdate(r.created_at)}</td>`,
  detail: (r, reload) => {
    const d = drawer(`<h2 style="margin:0">${esc(r.ticket)}</h2>` + kv([['Category', esc(r.category)], ['District', esc(r.district)], ['From', r.anonymous ? '<i>Anonymous</i>' : esc(r.name) + '<br>' + esc(r.phone)], ['Submitted', fdate(r.created_at, 1)], ['Updated', fdate(r.updated_at, 1)], ['Complaint', esc(r.description).replace(/\n/g, '<br>')], ['Photo', r.photo ? '<button class="btn ghost sm" id="ph" type="button">View photo (5 min link)</button>' : '—']]) +
      `<form class="form" id="cf"><label>Status<select name="s">${opts(DATASETS.complaints.enums.status, r.status)}</select></label>
       <label>Public reply <span class="muted small">(the citizen sees this)</span><textarea name="r" maxlength="1000">${esc(r.reply)}</textarea></label>
       <label>Internal note <span class="muted small">(private, admins only)</span><textarea name="n" maxlength="2000">${esc(r.internal_note)}</textarea></label>
       <div class="msg" id="cm"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" id="cl">Close</button></div></form>`);
    $('#cl', d).onclick = () => $('#drawer').close();
    if (r.photo) $('#ph', d).onclick = async () => { try { window.open(await api.signedUrl('yw-complaints', r.photo), '_blank', 'noopener'); } catch (e) { toast(e.message, 1); } };
    $('#cf', d).onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      try { await api.req('yw_complaints?id=' + eq(r.id), { method: 'PATCH', body: { status: f.s.value, reply: f.r.value.trim() || null, internal_note: f.n.value.trim() || null, updated_at: new Date().toISOString() }, headers: { Prefer: 'return=minimal' } }); toast('Complaint updated'); $('#drawer').close(); reload(); }
      catch (err) { $('#cm', d).className = 'msg bad'; $('#cm', d).textContent = err.message; }
    };
  }
});

VIEWS.ideas = dataView('ideas', {
  title: 'Ideas', sub: 'Member ideas. Only Approved, Under review, Accepted and Done ideas are shown publicly (first name only).',
  head: ['Idea', 'Category', 'By', 'District', 'Status', 'Submitted'],
  row: r => `<td><b>${esc(r.title)}</b>${r.is_sample ? ' ' + chip('Sample', 'sample') : ''}<div class="clip muted">${esc(r.description)}</div></td><td>${esc(r.category)}</td><td>${esc(r.name)}</td><td>${esc(r.district)}</td><td>${chip(r.status, r.status.replace(' ', ''))}</td><td>${fdate(r.created_at)}</td>`,
  detail: (r, reload) => {
    const d = drawer(`<h2 style="margin:0">${esc(r.title)}</h2>` + kv([['Category', esc(r.category)], ['By', esc(r.name)], ['District', esc(r.district)], ['Submitted', fdate(r.created_at, 1)], ['Idea', esc(r.description).replace(/\n/g, '<br>')]]) +
      `<form class="form" id="if"><label>Status<select name="s">${opts(DATASETS.ideas.enums.status, r.status)}</select></label><div class="msg" id="im"></div>
       <div class="row"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" id="cl">Close</button></div></form>`);
    $('#cl', d).onclick = () => $('#drawer').close();
    $('#if', d).onsubmit = async e => {
      e.preventDefault();
      try { await api.req('yw_ideas?id=' + eq(r.id), { method: 'PATCH', body: { status: e.target.s.value }, headers: { Prefer: 'return=minimal' } }); toast('Idea updated'); $('#drawer').close(); reload(); }
      catch (err) { $('#im', d).className = 'msg bad'; $('#im', d).textContent = err.message; }
    };
  }
});

// ---------- Simple paged list helper for content tables ----------
function contentList(key, { path, head, row, empty }) {
  const st = S[key] ||= { page: 0, size: 20, q: '', status: '' };
  return async (box, actions) => {
    try {
      const { rows, total } = await api.page(path(st), st.page * st.size, st.size);
      box.innerHTML = rows.length ? `<div class="tbl-wrap"><table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map((r, i) => `<tr data-i="${i}">${row(r)}</tr>`).join('')}</table></div>${pager(st, total, st.size)}` : `<div class="tbl-wrap"><div class="empty">${empty}</div></div>`;
      bindPager(box, st, () => contentList(key, { path, head, row, empty })(box, actions));
      actions(rows, box);
    } catch (e) { if (e.status !== 401) box.innerHTML = failBox(e); }
  };
}
const ilike = (col, q) => q ? `&${col}=ilike.${encodeURIComponent('*' + cleanSearch(q) + '*')}` : '';

// ---------- Feeds ----------
VIEWS.feeds = async () => {
  const acts = await api.req('yw_activity_types?select=*&order=sort');
  const st = S.feeds ||= { page: 0, size: 20, q: '', status: '' };
  V.innerHTML = `<h1 class="pg">Feeds &amp; posts</h1><p class="pg-sub">Drafts and unpublished feeds are never shown publicly. Points count only while a feed is published.</p>
  <div class="two"><form class="card form" id="ff" novalidate><b id="fft">New feed</b><input type="hidden" name="id">
    <label>Title<input name="t" maxlength="140"></label><label>Description<textarea name="d" maxlength="2000"></textarea></label>
    <div class="g2"><label>District<select name="s">${opts(DISTRICTS, '', 'Select')}</select></label><label>Activity<select name="a">${opts(acts.map(a => [a.id, `${a.name} (${a.points} pts)`]), '', 'Select')}</select></label></div>
    <div class="g2"><label>Activity date<input name="dt" type="date"></label><label>Status<select name="st">${opts([['draft', 'Draft'], ['published', 'Published']], 'draft')}</select></label></div>
    <label id="mrow">Member IDs credited<input name="m" placeholder="YW-000123, YW-000124"></label>
    <label id="prow">Photos (up to 4, max 2 MB each)<input name="ph" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
    <label class="ck" id="crow"><input type="checkbox" name="ok">Photos are shared with consent of everyone shown.</label>
    <div><span class="muted small">Preview</span><div class="pv" id="pv"><img alt="" id="pvi" hidden><div><h3 id="pvt">Title</h3><p id="pvd">Description</p></div></div></div>
    <div class="msg" id="fm"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn ghost" type="reset">Clear</button></div></form>
  <div><div class="bar"><label class="q">Search<input id="fq" type="search" value="${esc(st.q)}" placeholder="Title…"></label><label>Status<select id="fs">${opts(['draft', 'published', 'unpublished'], st.status, 'All')}</select></label></div><div id="fl">${skeleton(5)}</div></div></div>`;
  const f = $('#ff', V), today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  f.dt.value = today;
  const pv = () => { $('#pvt', V).textContent = f.t.value || 'Title'; $('#pvd', V).textContent = f.d.value || 'Description'; };
  f.t.oninput = f.d.oninput = pv;
  f.ph.onchange = () => { const x = f.ph.files[0], i = $('#pvi', V); if (x) { i.src = URL.createObjectURL(x); i.hidden = false; } else i.hidden = true; };
  f.onreset = () => setTimeout(() => { f.id.value = ''; $('#fft', V).textContent = 'New feed'; ['mrow', 'prow', 'crow'].forEach(i => $('#' + i, V).hidden = false); f.dt.value = today; $('#pvi', V).hidden = true; pv(); });
  const list = contentList('feeds', {
    path: s => 'yw_feeds?select=*,yw_feed_credits(member_id,points,reversed)&order=created_at.desc' + ilike('title', s.q) + (s.status ? '&status=' + eq(s.status) : ''),
    head: ['Feed', 'Credits', 'Status', ''], empty: 'No feeds.',
    row: x => `<td><b>${esc(x.title)}</b>${x.is_sample ? ' ' + chip('Sample', 'sample') : ''}<br><span class="muted small">${esc(x.district)} · ${fdate(x.activity_date)}</span></td><td class="small">${(x.yw_feed_credits || []).map(c => esc(c.member_id) + ' +' + c.points + (c.reversed ? ' <s>reversed</s>' : '')).join('<br>') || '—'}</td><td><select data-st="${x.id}">${opts(['draft', 'published', 'unpublished'], x.status)}</select></td><td><div class="row"><button class="btn ghost sm" data-e="${x.id}">Edit</button><button class="btn ghost sm" data-r="${x.id}">Reverse pts</button><button class="btn danger sm" data-x="${x.id}">Delete</button></div></td>`
  });
  const reload = () => list($('#fl', V), (rows, box) => {
    $$('[data-st]', box).forEach(s => s.onchange = async () => { try { await api.req('yw_feeds?id=' + eq(s.dataset.st), { method: 'PATCH', body: { status: s.value }, headers: { Prefer: 'return=minimal' } }); toast('Status: ' + s.value); } catch (e) { toast(e.message, 1); } });
    $$('[data-e]', box).forEach(b => b.onclick = () => { const x = rows.find(r => r.id === b.dataset.e); f.id.value = x.id; f.t.value = x.title; f.d.value = x.description; f.s.value = x.district; f.a.value = x.activity_type_id; f.dt.value = x.activity_date; f.st.value = x.status === 'unpublished' ? 'draft' : x.status; $('#fft', V).textContent = 'Edit feed'; ['mrow', 'prow', 'crow'].forEach(i => $('#' + i, V).hidden = true); const i = $('#pvi', V); if (safeUrl((x.photos || [])[0])) { i.src = x.photos[0]; i.hidden = false; } pv(); f.scrollIntoView({ behavior: 'smooth' }); });
    $$('[data-r]', box).forEach(b => b.onclick = async () => { if (!confirm('Reverse all points credited for this feed?')) return; try { await api.req('yw_feed_credits?feed_id=' + eq(b.dataset.r), { method: 'PATCH', body: { reversed: true }, headers: { Prefer: 'return=minimal' } }); toast('Points reversed'); reload(); } catch (e) { toast(e.message, 1); } });
    $$('[data-x]', box).forEach(b => b.onclick = async () => { if (!confirmTyped('this feed and its points')) return; try { await api.req('yw_feeds?id=' + eq(b.dataset.x), { method: 'DELETE' }); toast('Deleted'); reload(); } catch (e) { toast(e.message, 1); } });
  });
  $('#fq', V).oninput = debounce(e => { st.q = e.target.value; st.page = 0; reload(); });
  $('#fs', V).onchange = e => { st.status = e.target.value; st.page = 0; reload(); };
  f.onsubmit = async e => {
    e.preventDefault(); const m = $('#fm', V), msg = (t, ok) => { m.className = 'msg ' + (ok ? 'good' : 'bad'); m.textContent = t; };
    if (f.t.value.trim().length < 3 || f.d.value.trim().length < 3) return msg('Enter a title and description.');
    if (!f.s.value || !f.a.value || !f.dt.value) return msg('Select district, activity and date.');
    const btn = $('button[type=submit]', f); btn.disabled = true;
    try {
      if (f.id.value) {
        await api.req('yw_feeds?id=' + eq(f.id.value), { method: 'PATCH', body: { title: f.t.value.trim(), description: f.d.value.trim(), district: f.s.value, activity_type_id: +f.a.value, activity_date: f.dt.value, status: f.st.value }, headers: { Prefer: 'return=minimal' } });
      } else {
        const mem = f.m.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean), files = [...f.ph.files];
        if (mem.some(x => !/^YW-\d{6}$/.test(x))) throw new Error('Member IDs must look like YW-000123.');
        if (files.length > 4) throw new Error('Up to 4 photos only.');
        if (!f.ok.checked) throw new Error('Tick the photo consent box.');
        msg('Uploading…', 1);
        const urls = []; for (const x of files) { const p = 'f/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.webp'; await api.upload('yw-feeds', p, await compress(x), 'image/webp'); urls.push(api.publicUrl('yw-feeds', p)); }
        await api.rpc('yw_admin_create_feed', { p_title: f.t.value.trim(), p_description: f.d.value.trim(), p_photos: urls, p_district: f.s.value, p_activity: +f.a.value, p_date: f.dt.value, p_members: mem, p_consent: true, p_status: f.st.value });
      }
      toast('Feed saved'); f.reset(); reload(); msg('', 1);
    } catch (err) { msg(err.message.replace('daily_cap:', 'Daily limit reached:')); }
    btn.disabled = false;
  };
  reload();
};

// ---------- Podcast ----------
VIEWS.podcast = async () => {
  const st = S.podcast ||= { page: 0, size: 20, q: '' };
  const sv = ((await api.req('yw_settings?key=eq.speaker_month&select=value'))[0] || {}).value || {};
  V.innerHTML = `<h1 class="pg">Podcast</h1><p class="pg-sub">Episodes link to YouTube / Spotify / Instagram. Unpublished episodes are hidden from the public page.</p>
  <div class="two"><div><form class="card form" id="pf" novalidate><b id="pft">New episode</b><input type="hidden" name="id">
    <div class="g2"><label>Category<select name="c">${opts([['general', 'General Discussions'], ['book', 'Book Discussions']], 'general')}</select></label><label>Date<input name="dt" type="date"></label></div>
    <label>Title<input name="t" maxlength="200"></label><label>Speaker<input name="sp" maxlength="80"></label>
    <label>YouTube link<input name="yt" type="url"></label><div class="g2"><label>Spotify link<input name="sf" type="url"></label><label>Instagram link<input name="ig" type="url"></label></div>
    <label>Cover image URL <span class="muted small">(blank = YouTube thumbnail)</span><input name="th" type="url"></label>
    <div class="row"><label class="ck"><input type="checkbox" name="lv">Live stream</label><label class="ck"><input type="checkbox" name="pb" checked>Published</label></div>
    <div><span class="muted small">Preview</span><div class="pv"><img alt="" id="pvi" hidden><div><h3 id="pvt">Title</h3><p id="pvd"></p></div></div></div>
    <div class="msg" id="pm"></div><div class="row"><button class="btn" type="submit">Save episode</button><button class="btn ghost" type="reset">Clear</button></div></form>
    <form class="card form" id="smf" style="margin-top:16px"><b>Speaker of the Month</b><label>Name<input name="n" maxlength="80" value="${esc(sv.name)}"></label><label>About<input name="a" maxlength="300" value="${esc(sv.about)}"></label><label>Link<input name="l" type="url" value="${esc(sv.link)}"></label><div><button class="btn" type="submit">Save</button></div></form></div>
  <div><div class="bar"><label class="q">Search<input id="pq" type="search" value="${esc(st.q)}" placeholder="Title…"></label></div><div id="pl">${skeleton(5)}</div></div></div>`;
  const f = $('#pf', V);
  const pv = () => { $('#pvt', V).textContent = f.t.value || 'Title'; $('#pvd', V).textContent = f.sp.value; const th = safeUrl(f.th.value) || (ytId(f.yt.value) ? `https://i.ytimg.com/vi/${ytId(f.yt.value)}/hqdefault.jpg` : ''); const i = $('#pvi', V); i.hidden = !th; if (th) i.src = th; };
  ['t', 'sp', 'yt', 'th'].forEach(n => f[n].oninput = pv);
  f.onreset = () => setTimeout(() => { f.id.value = ''; $('#pft', V).textContent = 'New episode'; pv(); });
  const list = contentList('podcast', {
    path: s => 'yw_podcast_episodes?select=*&order=created_at.desc' + ilike('title', s.q),
    head: ['Episode', 'Status', ''], empty: 'No episodes.',
    row: e => `<td><b>${esc(e.title)}</b><br><span class="muted small">${esc(e.category)}${e.is_live ? ' · live' : ''}${e.speaker ? ' · ' + esc(e.speaker) : ''}</span></td><td>${chip(e.published === false ? 'unpublished' : 'published')}</td><td><div class="row"><button class="btn ghost sm" data-e="${e.id}">Edit</button><button class="btn ghost sm" data-p="${e.id}" data-v="${e.published === false}">${e.published === false ? 'Publish' : 'Unpublish'}</button><button class="btn danger sm" data-x="${e.id}">Delete</button></div></td>`
  });
  const reload = () => list($('#pl', V), (rows, box) => {
    $$('[data-e]', box).forEach(b => b.onclick = () => { const e = rows.find(r => r.id === b.dataset.e); Object.assign(f, {}); f.id.value = e.id; f.c.value = e.category; f.t.value = e.title; f.sp.value = e.speaker || ''; f.dt.value = e.ep_date || ''; f.yt.value = e.youtube || ''; f.sf.value = e.spotify || ''; f.ig.value = e.instagram || ''; f.th.value = e.thumbnail || ''; f.lv.checked = e.is_live; f.pb.checked = e.published !== false; $('#pft', V).textContent = 'Edit episode'; pv(); f.scrollIntoView({ behavior: 'smooth' }); });
    $$('[data-p]', box).forEach(b => b.onclick = async () => { try { await api.req('yw_podcast_episodes?id=' + eq(b.dataset.p), { method: 'PATCH', body: { published: b.dataset.v === 'true' }, headers: { Prefer: 'return=minimal' } }); reload(); } catch (e) { toast(e.message, 1); } });
    $$('[data-x]', box).forEach(b => b.onclick = async () => { if (!confirmTyped('this episode')) return; try { await api.req('yw_podcast_episodes?id=' + eq(b.dataset.x), { method: 'DELETE' }); toast('Deleted'); reload(); } catch (e) { toast(e.message, 1); } });
  });
  $('#pq', V).oninput = debounce(e => { st.q = e.target.value; st.page = 0; reload(); });
  f.onsubmit = async e => {
    e.preventDefault(); const m = $('#pm', V);
    if (f.t.value.trim().length < 2) { m.className = 'msg bad'; m.textContent = 'Enter a title.'; return; }
    for (const n of ['yt', 'sf', 'ig', 'th']) if (f[n].value.trim() && !safeUrl(f[n].value)) { m.className = 'msg bad'; m.textContent = 'Links must start with https://'; return; }
    const yt = safeUrl(f.yt.value), id = ytId(yt);
    const body = { category: f.c.value, title: f.t.value.trim(), speaker: f.sp.value.trim() || null, ep_date: f.dt.value || null, youtube: yt || null, spotify: safeUrl(f.sf.value) || null, instagram: safeUrl(f.ig.value) || null, thumbnail: safeUrl(f.th.value) || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null), is_live: f.lv.checked, published: f.pb.checked };
    try { if (f.id.value) await api.req('yw_podcast_episodes?id=' + eq(f.id.value), { method: 'PATCH', body, headers: { Prefer: 'return=minimal' } }); else await api.req('yw_podcast_episodes', { method: 'POST', body, headers: { Prefer: 'return=minimal' } }); toast('Episode saved'); f.reset(); reload(); }
    catch (err) { m.className = 'msg bad'; m.textContent = err.message; }
  };
  $('#smf', V).onsubmit = async e => { e.preventDefault(); const g = e.target; try { await api.req('yw_settings?key=eq.speaker_month', { method: 'PATCH', body: { value: { name: g.n.value.trim(), about: g.a.value.trim(), link: safeUrl(g.l.value) } }, headers: { Prefer: 'return=minimal' } }); toast('Saved'); } catch (err) { toast(err.message, 1); } };
  reload();
};

// ---------- Bookshelf ----------
VIEWS.books = async () => {
  const st = S.books ||= { page: 0, size: 20, q: '' };
  const eps = await api.req('yw_podcast_episodes?select=id,title&order=created_at.desc');
  V.innerHTML = `<h1 class="pg">Bookshelf</h1><p class="pg-sub">Newest books appear first on the public Bookshelf. Unpublished books are hidden.</p>
  <div class="two"><form class="card form" id="bf" novalidate><b id="bft">New book</b><input type="hidden" name="id">
    <div class="g2"><label>Title<input name="t" maxlength="200"></label><label>Author<input name="a" maxlength="120"></label></div>
    <label>Why read this (one line)<input name="w" maxlength="200"></label>
    <div class="g2"><label>Level<select name="l">${opts(['Beginner', 'Deeper'], 'Beginner')}</select></label><label>Category<input name="c" maxlength="40" placeholder="History"></label></div>
    <label>Cover image URL<input name="cv" type="url"></label><label>Buy / read link<input name="az" type="url"></label>
    <label>Related episode<select name="ep">${opts(eps.map(e => [e.id, e.title]), '', 'None')}</select></label>
    <label class="ck"><input type="checkbox" name="pb" checked>Published</label>
    <div><span class="muted small">Preview</span><div class="pv"><img alt="" id="pvi" hidden><div><h3 id="pvt">Title</h3><p id="pvd"></p></div></div></div>
    <div class="msg" id="bm"></div><div class="row"><button class="btn" type="submit">Save book</button><button class="btn ghost" type="reset">Clear</button></div></form>
  <div><div class="bar"><label class="q">Search<input id="bq" type="search" value="${esc(st.q)}" placeholder="Title…"></label></div><div id="bl">${skeleton(5)}</div></div></div>`;
  const f = $('#bf', V);
  const pv = () => { $('#pvt', V).textContent = f.t.value || 'Title'; $('#pvd', V).textContent = (f.a.value ? 'by ' + f.a.value + ' — ' : '') + f.w.value; const u = safeUrl(f.cv.value), i = $('#pvi', V); i.hidden = !u; if (u) i.src = u; };
  ['t', 'a', 'w', 'cv'].forEach(n => f[n].oninput = pv);
  f.onreset = () => setTimeout(() => { f.id.value = ''; $('#bft', V).textContent = 'New book'; pv(); });
  const list = contentList('books', {
    path: s => 'yw_books?select=*&order=created_at.desc' + ilike('title', s.q),
    head: ['Book', 'Status', ''], empty: 'No books.',
    row: b => `<td><b>${esc(b.title)}</b>${b.is_sample ? ' ' + chip('Sample', 'sample') : ''}<br><span class="muted small">${esc(b.author)} · ${esc(b.category)} · ${esc(b.level)}</span></td><td>${chip(b.published === false ? 'unpublished' : 'published')}</td><td><div class="row"><button class="btn ghost sm" data-e="${b.id}">Edit</button><button class="btn ghost sm" data-p="${b.id}" data-v="${b.published === false}">${b.published === false ? 'Publish' : 'Unpublish'}</button><button class="btn danger sm" data-x="${b.id}">Delete</button></div></td>`
  });
  const reload = () => list($('#bl', V), (rows, box) => {
    $$('[data-e]', box).forEach(b => b.onclick = () => { const x = rows.find(r => r.id === b.dataset.e); f.id.value = x.id; f.t.value = x.title; f.a.value = x.author; f.w.value = x.why || ''; f.l.value = x.level; f.c.value = x.category; f.cv.value = x.cover || ''; f.az.value = x.amazon_url || ''; f.ep.value = x.episode_id || ''; f.pb.checked = x.published !== false; $('#bft', V).textContent = 'Edit book'; pv(); f.scrollIntoView({ behavior: 'smooth' }); });
    $$('[data-p]', box).forEach(b => b.onclick = async () => { try { await api.req('yw_books?id=' + eq(b.dataset.p), { method: 'PATCH', body: { published: b.dataset.v === 'true' }, headers: { Prefer: 'return=minimal' } }); reload(); } catch (e) { toast(e.message, 1); } });
    $$('[data-x]', box).forEach(b => b.onclick = async () => { if (!confirmTyped('this book')) return; try { await api.req('yw_books?id=' + eq(b.dataset.x), { method: 'DELETE' }); toast('Deleted'); reload(); } catch (e) { toast(e.message, 1); } });
  });
  $('#bq', V).oninput = debounce(e => { st.q = e.target.value; st.page = 0; reload(); });
  f.onsubmit = async e => {
    e.preventDefault(); const m = $('#bm', V);
    if (f.t.value.trim().length < 2 || f.a.value.trim().length < 2) { m.className = 'msg bad'; m.textContent = 'Enter title and author.'; return; }
    for (const n of ['cv', 'az']) if (f[n].value.trim() && !safeUrl(f[n].value)) { m.className = 'msg bad'; m.textContent = 'Links must start with https://'; return; }
    const body = { title: f.t.value.trim(), author: f.a.value.trim(), why: f.w.value.trim() || null, level: f.l.value, category: f.c.value.trim() || 'General', cover: safeUrl(f.cv.value) || null, amazon_url: safeUrl(f.az.value) || null, episode_id: f.ep.value || null, published: f.pb.checked };
    try { if (f.id.value) await api.req('yw_books?id=' + eq(f.id.value), { method: 'PATCH', body, headers: { Prefer: 'return=minimal' } }); else await api.req('yw_books', { method: 'POST', body, headers: { Prefer: 'return=minimal' } }); toast('Book saved'); f.reset(); reload(); }
    catch (err) { m.className = 'msg bad'; m.textContent = err.message; }
  };
  reload();
};

// ---------- Leaderboard (derived from feed credits; no arbitrary score edits) ----------
VIEWS.leaderboard = async () => {
  const st = S.lb ||= { page: 0, size: 25, q: '', district: '', by: 'points' };
  V.innerHTML = `<h1 class="pg">Leaderboard</h1><p class="pg-sub">Scores are calculated from credits on <b>published</b> feeds (max 3 earning feeds per member per day). To correct a score, reverse or restore individual credits — every change is audit-logged.</p>
  <div class="bar"><label class="q">Search<input id="lq" type="search" value="${esc(st.q)}" placeholder="Member ID or first name"></label><label>District<select id="ld">${opts(DISTRICTS, st.district, 'All')}</select></label><label>Rank by<select id="lr">${opts([['points', 'All-time'], ['week_points', 'This week']], st.by)}</select></label></div>
  <div id="ll">${skeleton(8)}</div>
  <h2>Seva Star of the Week</h2><form class="card form" id="ssf" style="max-width:520px"><div class="g2"><label>Member ID<input name="m" placeholder="YW-000123"></label><label>Note<input name="n" maxlength="200"></label></div><div><button class="btn" type="submit">Confirm Seva Star</button></div></form>`;
  const q = s => `yw_admin_member_points?select=*&order=${s.by}.desc,member_id.asc` + (s.q ? (/^YW-/i.test(s.q) ? '&member_id=' + eq(s.q.toUpperCase().trim()) : ilike('first_name', s.q)) : '') + (s.district ? '&district=' + eq(s.district) : '');
  const list = contentList('lb', {
    path: q, head: ['#', 'Member', 'District', 'All-time', 'This week', 'Reversed'], empty: 'No members.',
    row: r => `<td class="muted">—</td><td><b>${esc(r.member_id)}</b> ${esc(r.first_name)}${r.is_sample ? ' ' + chip('Sample', 'sample') : ''}</td><td>${esc(r.district)}</td><td><b>${r.points}</b></td><td>${r.week_points}</td><td>${r.reversed_credits || 0}</td>`
  });
  const reload = () => list($('#ll', V), (rows, box) => {
    $$('tr[data-i]', box).forEach(tr => { const r = rows[+tr.dataset.i]; tr.firstElementChild.textContent = st.page * st.size + +tr.dataset.i + 1; tr.classList.add('click'); tr.onclick = () => credits(r, reload); });
  });
  $('#lq', V).oninput = debounce(e => { st.q = cleanSearch(e.target.value); st.page = 0; reload(); });
  $('#ld', V).onchange = e => { st.district = e.target.value; st.page = 0; reload(); };
  $('#lr', V).onchange = e => { st.by = e.target.value; st.page = 0; reload(); };
  $('#ssf', V).onsubmit = async e => {
    e.preventDefault(); const id = e.target.m.value.trim().toUpperCase(); if (!/^YW-\d{6}$/.test(id)) return toast('Member ID looks like YW-000123', 1);
    const d = new Date(Date.now() + 330 * 60000), wk = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
    try { await api.req('yw_seva_star', { method: 'POST', body: { week_start: wk, member_id: id, note: e.target.n.value.trim() || null }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } }); toast('Seva Star confirmed for week of ' + wk); } catch (err) { toast(err.message, 1); }
  };
  reload();
};
async function credits(r, reloadList) {
  const d = drawer(`<h2 style="margin:0">${esc(r.member_id)} · ${esc(r.first_name)}</h2><p class="muted" style="margin:0">${esc(r.district)} · ${r.points} pts all-time</p><div id="cr">${skeleton(4)}</div><div><button class="btn ghost" id="cl" type="button">Close</button></div>`);
  $('#cl', d).onclick = () => $('#drawer').close();
  const load = async () => {
    const rows = await api.req('yw_feed_credits?select=id,points,credit_date,reversed,yw_feeds(title,status)&member_id=' + eq(r.member_id) + '&order=credit_date.desc&limit=200');
    $('#cr', d).innerHTML = rows.length ? `<div class="tbl-wrap"><table><tr><th>Date</th><th>Feed</th><th>Pts</th><th></th></tr>${rows.map(c => `<tr><td>${fdate(c.credit_date)}</td><td>${esc(c.yw_feeds && c.yw_feeds.title)} ${chip(c.yw_feeds && c.yw_feeds.status)}</td><td>${c.reversed ? '<s>' + c.points + '</s>' : c.points}</td><td><button class="btn ${c.reversed ? 'ghost' : 'danger'} sm" data-c="${c.id}" data-v="${!c.reversed}">${c.reversed ? 'Restore' : 'Reverse'}</button></td></tr>`).join('')}</table></div>` : '<div class="empty">No credits yet.</div>';
    $$('[data-c]', d).forEach(b => b.onclick = async () => { if (!confirm((b.dataset.v === 'true' ? 'Reverse' : 'Restore') + ' this credit?')) return; try { await api.req('yw_feed_credits?id=' + eq(b.dataset.c), { method: 'PATCH', body: { reversed: b.dataset.v === 'true' }, headers: { Prefer: 'return=minimal' } }); toast('Updated'); load(); reloadList(); } catch (e) { toast(e.message.replace('daily_cap:', 'Daily limit:'), 1); } });
  };
  load().catch(e => $('#cr', d).innerHTML = failBox(e));
}

// ---------- Inbox ----------
VIEWS.inbox = async () => {
  V.innerHTML = `<h1 class="pg">Inbox</h1><p class="pg-sub">Speaker applications and book suggestions from the public site.</p><h2>Speaker applications</h2><div id="sa">${skeleton(3)}</div><h2>Book suggestions</h2><div id="bs">${skeleton(3)}</div>`;
  contentList('sa', { path: () => 'yw_speaker_applications?select=*&order=created_at.desc', head: ['Name', 'Phone', 'District / college', 'Sample', 'Received'], empty: 'No applications.',
    row: x => `<td>${esc(x.name)}</td><td>${esc(x.phone)}</td><td>${esc(x.district)}<br><span class="muted small">${esc(x.college)}</span></td><td>${safeUrl(x.sample_link) ? `<a href="${esc(safeUrl(x.sample_link))}" target="_blank" rel="noopener noreferrer">Open</a>` : '—'}</td><td>${fdate(x.created_at)}</td>` })($('#sa', V), () => {});
  contentList('bs', { path: () => 'yw_book_suggestions?select=*&order=created_at.desc', head: ['Book', 'Why', 'From', 'Received'], empty: 'No suggestions.',
    row: x => `<td><b>${esc(x.title)}</b><br><span class="muted small">${esc(x.author)}</span></td><td>${esc(x.why)}</td><td>${esc(x.name)}</td><td>${fdate(x.created_at)}</td>` })($('#bs', V), () => {});
};

// ---------- Admin activity (audit log) ----------
VIEWS.activity = async () => {
  const st = S.audit ||= { page: 0, size: 30, table: '', action: '' };
  const T = ['yw_members', 'yw_complaints', 'yw_ideas', 'yw_feeds', 'yw_feed_credits', 'yw_books', 'yw_podcast_episodes', 'yw_settings', 'yw_activity_types', 'yw_seva_star', 'yw_admins', 'members', 'complaints', 'ideas'];
  V.innerHTML = `<h1 class="pg">Admin activity</h1><p class="pg-sub">Append-only log of every admin change and export. Nobody can edit or delete entries from the app.</p>
  <div class="bar"><label>Area<select id="at">${opts(T, st.table, 'All')}</select></label><label>Action<select id="aa">${opts(['INSERT', 'UPDATE', 'DELETE', 'EXPORT'], st.action, 'All')}</select></label></div><div id="al">${skeleton(8)}</div>`;
  const list = contentList('audit', {
    path: s => 'yw_audit_log?select=*&order=at.desc' + (s.table ? '&table_name=' + eq(s.table) : '') + (s.action ? '&action=' + eq(s.action) : ''),
    head: ['When', 'Who', 'Action', 'Area', 'Record'], empty: 'No activity yet.',
    row: a => `<td>${fdate(a.at, 1)}</td><td>${esc(a.actor_email || '—')}</td><td>${chip(a.action)}</td><td>${esc(a.table_name)}</td><td class="small">${esc(a.row_id || (a.after && a.after.rows != null ? a.after.rows + ' rows' : ''))}</td>`
  });
  const reload = () => list($('#al', V), (rows, box) => $$('tr[data-i]', box).forEach(tr => { tr.classList.add('click'); tr.onclick = () => {
    const a = rows[+tr.dataset.i], b = a.before || {}, n = a.after || {}, keys = [...new Set([...Object.keys(b), ...Object.keys(n)])].filter(k => JSON.stringify(b[k]) !== JSON.stringify(n[k]));
    const d = drawer(`<h2 style="margin:0">${esc(a.action)} · ${esc(a.table_name)}</h2><p class="muted" style="margin:0">${esc(a.actor_email || '')} · ${fdate(a.at, 1)}</p><div class="tbl-wrap"><table><tr><th>Field</th><th>Before</th><th>After</th></tr>${keys.map(k => `<tr><td>${esc(k)}</td><td class="small">${esc(JSON.stringify(b[k]) ?? '')}</td><td class="small">${esc(JSON.stringify(n[k]) ?? '')}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">No field changes.</td></tr>'}</table></div><div><button class="btn ghost" id="cl" type="button">Close</button></div>`);
    $('#cl', d).onclick = () => $('#drawer').close(); }; }));
  $('#at', V).onchange = e => { st.table = e.target.value; st.page = 0; reload(); };
  $('#aa', V).onchange = e => { st.action = e.target.value; st.page = 0; reload(); };
  reload();
};

// ---------- Settings ----------
VIEWS.settings = async () => {
  const [acts, ce, admins] = await Promise.all([api.req('yw_activity_types?select=*&order=sort'), api.req('yw_settings?key=eq.contact_email&select=value'), api.req('yw_admins?select=email,added_at&order=added_at')]);
  V.innerHTML = `<h1 class="pg">Settings</h1><p class="pg-sub">Points apply to feeds published after the change.</p>
  <div class="two"><div class="card"><b>Points table</b><div class="tbl-wrap" style="margin-top:10px"><table>${acts.map(a => `<tr><td>${esc(a.name)}</td><td style="width:110px"><input type="number" min="0" max="100" value="${a.points}" data-pt="${a.id}"></td></tr>`).join('')}</table></div><p><button class="btn" id="sp" type="button">Save points</button></p></div>
  <div><form class="card form" id="cef"><b>Contact email for feed submissions</b><label>Email<input name="e" type="email" value="${esc(ce[0] && ce[0].value && ce[0].value.email)}"></label><div><button class="btn" type="submit">Save</button></div></form>
  <div class="card" style="margin-top:16px"><b>Administrators</b><div class="tbl-wrap" style="margin-top:10px"><table>${admins.map(a => `<tr><td>${esc(a.email)}</td><td class="muted small">${fdate(a.added_at)}</td></tr>`).join('')}</table></div>
  <p class="muted small">For security, administrators are added only from the Supabase SQL editor by the project owner (see README_ADMIN.md). Accounts are never promoted automatically.</p></div></div></div>`;
  $('#sp', V).onclick = async () => { try { for (const i of $$('[data-pt]', V)) { const v = Math.max(0, Math.min(100, parseInt(i.value, 10) || 0)); await api.req('yw_activity_types?id=' + eq(i.dataset.pt), { method: 'PATCH', body: { points: v }, headers: { Prefer: 'return=minimal' } }); } toast('Points saved'); } catch (e) { toast(e.message, 1); } };
  $('#cef', V).onsubmit = async e => { e.preventDefault(); const v = e.target.e.value.trim(); if (v && !/^\S+@\S+\.\S+$/.test(v)) return toast('Enter a valid email', 1); try { await api.req('yw_settings?key=eq.contact_email', { method: 'PATCH', body: { value: { email: v } }, headers: { Prefer: 'return=minimal' } }); toast('Saved'); } catch (err) { toast(err.message, 1); } };
};

// ---------- boot ----------
if (api.signedIn && await api.isAdmin()) start(); else { if (api.signedIn) await api.signOut(); showLogin(); }
