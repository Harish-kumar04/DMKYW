// Youth Wing admin: dataset definitions + safe filter -> PostgREST query builder.
// Pure module (no DOM, no network) so it can be unit-tested with node:test.

export const DISTRICTS = ['Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri','Dindigul','Erode','Kallakurichi','Kanchipuram','Kanyakumari','Karur','Krishnagiri','Madurai','Mayiladuthurai','Nagapattinam','Namakkal','Nilgiris','Perambalur','Pudukkottai','Ramanathapuram','Ranipet','Salem','Sivaganga','Tenkasi','Thanjavur','Theni','Thoothukudi','Tiruchirappalli','Tirunelveli','Tirupathur','Tiruppur','Tiruvallur','Tiruvannamalai','Tiruvarur','Vellore','Viluppuram','Virudhunagar'];

// type: text | date | bool | num. pii: masked unless the admin opts in.
export const DATASETS = {
  members: {
    label: 'Youth_Wing_Members',
    source: 'yw_admin_members',            // security_invoker view (admin RLS), see yw_admin_v2.sql
    search: ['name', 'contact', 'member_id'],
    dateCol: 'created_at',
    filters: { district: 'district', wants_kit: 'wants_kit' },
    sorts: ['created_at', 'name', 'district', 'member_id'],
    columns: [
      { key: 'member_id', label: 'Member ID', type: 'text' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'district', label: 'District', type: 'text' },
      { key: 'contact', label: 'Phone / Email', type: 'text', pii: 'contact' },
      { key: 'voter_last4', label: 'Voter ID (last 4)', type: 'text' },
      { key: 'wants_kit', label: 'Wants kit', type: 'bool' },
      { key: 'kit_size', label: 'Kit size', type: 'text' },
      { key: 'kit_address', label: 'Kit address', type: 'text', pii: 'address' },
      { key: 'kit_pincode', label: 'Kit pincode', type: 'text', pii: 'address' },
      { key: 'created_at', label: 'Joined on', type: 'date' }
    ]
  },
  complaints: {
    label: 'Youth_Wing_Complaints',
    source: 'yw_complaints',
    search: ['ticket', 'description', 'name'],
    dateCol: 'created_at',
    filters: { district: 'district', category: 'category', status: 'status' },
    enums: { category: ['Party', 'Local issue', 'Event', 'Other'], status: ['New', 'In review', 'Resolved'] },
    sorts: ['created_at', 'updated_at', 'status', 'district'],
    columns: [
      { key: 'ticket', label: 'Ticket', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'district', label: 'District', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'anonymous', label: 'Anonymous', type: 'bool' },
      { key: 'name', label: 'Name', type: 'text', pii: 'name' },
      { key: 'phone', label: 'Phone', type: 'text', pii: 'contact' },
      { key: 'reply', label: 'Public reply', type: 'text' },
      { key: 'internal_note', label: 'Internal note', type: 'text' },
      { key: 'created_at', label: 'Submitted on', type: 'date' },
      { key: 'updated_at', label: 'Updated on', type: 'date' }
    ]
  },
  ideas: {
    label: 'Youth_Wing_Ideas',
    source: 'yw_ideas',
    search: ['title', 'description', 'name'],
    dateCol: 'created_at',
    filters: { district: 'district', category: 'category', status: 'status' },
    enums: { category: ['Event', 'Social service', 'Content', 'Digital', 'Other'], status: ['Pending', 'Approved', 'Under review', 'Accepted', 'Done', 'Rejected'] },
    sorts: ['created_at', 'status', 'district', 'title'],
    columns: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'name', label: 'Submitted by', type: 'text', pii: 'name' },
      { key: 'district', label: 'District', type: 'text' },
      { key: 'is_sample', label: 'Sample', type: 'bool' },
      { key: 'created_at', label: 'Submitted on', type: 'date' }
    ]
  }
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = s => DATE_RE.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const nextDay = s => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

// Strip characters that carry meaning in PostgREST filter grammar.
export function cleanSearch(s) {
  return String(s ?? '').replace(/[,()*:"'\\%]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Validate and normalise a raw filter object. Throws on invalid input. */
export function validateFilters(dataset, raw = {}) {
  const ds = DATASETS[dataset];
  if (!ds) throw new Error('Unknown dataset');
  const f = {};
  const q = cleanSearch(raw.q);
  if (q) f.q = q;
  for (const k of ['from', 'to']) {
    if (raw[k]) { if (!isRealDate(raw[k])) throw new Error('Invalid ' + k + ' date'); f[k] = raw[k]; }
  }
  if (f.from && f.to && f.from > f.to) throw new Error('From date is after To date');
  if (raw.district) { if (!DISTRICTS.includes(raw.district)) throw new Error('Invalid district'); f.district = raw.district; }
  for (const k of ['category', 'status']) {
    if (raw[k] && ds.filters[k]) { if (!ds.enums[k].includes(raw[k])) throw new Error('Invalid ' + k); f[k] = raw[k]; }
  }
  if (ds.filters.wants_kit && (raw.wants_kit === 'true' || raw.wants_kit === 'false' || typeof raw.wants_kit === 'boolean')) f.wants_kit = String(raw.wants_kit);
  return f;
}

/** Build the PostgREST path (table + query string). Filtering always happens in the database. */
export function buildQuery(dataset, raw = {}, { sort, dir = 'desc', columns } = {}) {
  const ds = DATASETS[dataset];
  const f = validateFilters(dataset, raw);
  const allowed = ds.columns.map(c => c.key);
  const cols = (columns && columns.length ? columns : allowed).filter(c => allowed.includes(c));
  if (!cols.length) throw new Error('Select at least one column');
  const p = new URLSearchParams();
  p.set('select', [...new Set(dataset === 'complaints' ? [...cols, 'id', 'photo'] : dataset === 'members' ? [...cols, 'id'] : [...cols, 'id'])].join(','));
  if (f.q) p.set('or', '(' + ds.search.map(c => `${c}.ilike.*${f.q}*`).join(',') + ')');
  if (f.from) p.append(ds.dateCol, 'gte.' + f.from);
  if (f.to) p.append(ds.dateCol, 'lt.' + nextDay(f.to));
  for (const k of ['district', 'category', 'status', 'wants_kit']) if (f[k] != null && ds.filters[k]) p.set(ds.filters[k], (k === 'wants_kit' ? 'is.' : 'eq.') + f[k]);
  const s = ds.sorts.includes(sort) ? sort : ds.sorts[0];
  p.set('order', `${s}.${dir === 'asc' ? 'asc' : 'desc'}.nullslast,id.desc`);
  return ds.source + '?' + p.toString();
}

/** Fetch every matching row in batches. fetchPage(offset, limit) -> rows[] */
export async function fetchAll(fetchPage, { batch = 1000, cap = 50000, onProgress } = {}) {
  const out = [];
  for (let off = 0; ; off += batch) {
    const rows = await fetchPage(off, batch);
    out.push(...rows);
    onProgress && onProgress(out.length);
    if (out.length > cap) throw new Error(`More than ${cap} rows match. Narrow the filters.`);
    if (rows.length < batch) return out;
  }
}

export function exportFilename(dataset, ext, now = new Date()) {
  const d = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10); // IST date
  return `${DATASETS[dataset].label}_${d}.${ext}`;
}
