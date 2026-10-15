// Tiny in-memory PostgREST evaluator: applies the query strings our builder emits to synthetic rows.
// Used only by tests to prove that "what the admin filtered" === "what gets exported".
export function evalQuery(path, tables) {
  const [table, qs] = path.split('?');
  const rows = tables[table];
  if (!rows) throw new Error('no table ' + table);
  const p = new URLSearchParams(qs);
  const tests = [];
  for (const [k, v] of p) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    if (k === 'or') {
      const parts = v.slice(1, -1).split(',').map(s => { const [col, op, ...rest] = s.split('.'); return { col, op, val: rest.join('.') }; });
      tests.push(r => parts.some(t => match(r[t.col], t.op, t.val)));
    } else {
      const i = v.indexOf('.'); const op = v.slice(0, i), val = v.slice(i + 1);
      tests.push(r => match(r[k], op, val));
    }
  }
  let out = rows.filter(r => tests.every(t => t(r)));
  const [first] = (p.get('order') || '').split(',');
  if (first) { const [col, dir] = first.split('.'); out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'asc' ? 1 : -1)); }
  const cols = (p.get('select') || '*').split(',');
  return out.map(r => cols[0] === '*' ? r : Object.fromEntries(cols.map(c => [c, r[c]])));
}
function match(v, op, val) {
  switch (op) {
    case 'eq': return String(v) === val;
    case 'is': return String(v) === val;
    case 'gte': return String(v) >= val;
    case 'lt': return String(v) < val;
    case 'ilike': { const re = new RegExp('^' + val.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i'); return re.test(String(v ?? '')); }
    default: throw new Error('op ' + op);
  }
}
