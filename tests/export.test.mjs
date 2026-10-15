import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, toCSV, toXLSX, prepareRows, maskContact, crc32, excelSerial } from '../admin/export.mjs';
import { DATASETS } from '../admin/query.mjs';

// Read back a stored zip and verify every entry's CRC.
function unzip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), dec = new TextDecoder(), out = {};
  let e = buf.length - 22; assert.equal(dv.getUint32(e, true), 0x06054b50, 'EOCD');
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
  for (let i = 0; i < n; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50);
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(off + 26, true), data = buf.subarray(off + 30 + lnl, off + 30 + lnl + size);
    assert.equal(crc32(data), crc, 'crc ' + name);
    out[name] = dec.decode(data); p += 46 + nl;
  }
  return out;
}

const cols = DATASETS.members.columns;
const sample = [{ member_id: 'YW-000001', name: 'Karthik Raja', district: 'Salem', contact: '9876543210', voter_last4: '4567', wants_kit: true, kit_size: 'L', kit_address: '12, "Main" St\nSalem', kit_pincode: '636001', created_at: '2026-10-01T04:30:00Z' },
                { member_id: 'YW-000002', name: '=HYPERLINK("http://evil")', district: 'à®šà¯†à®©à¯à®©à¯ˆ', contact: 'a@b.com', voter_last4: '0001', wants_kit: false, kit_size: null, kit_address: null, kit_pincode: null, created_at: '2026-10-02T00:00:00Z' }];

test('CSV formula injection is neutralised', () => {
  for (const s of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx']) assert.ok(csvCell(s).replace(/^"/, '').startsWith("'"), s);
  assert.equal(csvCell('normal'), 'normal');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
});

test('CSV has BOM, headers, escaping, Tamil, dates in IST', () => {
  const csv = toCSV(cols, prepareRows(sample, cols, { includePII: true }));
  assert.ok(csv.startsWith('\uFEFFMember ID,Name,District'));
  assert.ok(csv.includes('à®šà¯†à®©à¯à®©à¯ˆ'));
  assert.ok(csv.includes('"12, ""Main"" St\nSalem"'));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('2026-10-01 10:00'));
  assert.equal(csv.trim().split('\r\n').length, 3);
});

test('PII is masked by default and included only on opt-in', () => {
  const masked = prepareRows(sample, cols)[0], full = prepareRows(sample, cols, { includePII: true })[0];
  const ci = cols.findIndex(c => c.key === 'contact'), ai = cols.findIndex(c => c.key === 'kit_address');
  assert.equal(masked[ci], '98xxxxx210'); assert.equal(masked[ai], '[hidden]');
  assert.equal(full[ci], '9876543210');
  assert.equal(maskContact('karthik@example.com'), 'ka***@example.com');
  const ideaCols = DATASETS.ideas.columns, ni = ideaCols.findIndex(c => c.key === 'name');
  assert.equal(prepareRows([{ name: 'Priya Devi' }], ideaCols)[0][ni], 'Priya');
});

test('XLSX is a valid zip with all required parts', () => {
  const files = unzip(toXLSX(cols, prepareRows(sample, cols, { includePII: true }), 'Members'));
  for (const f of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) assert.ok(files[f], f);
  const s = files['xl/worksheets/sheet1.xml'];
  assert.ok(s.includes('>Member ID<'));
  assert.ok(s.includes('à®šà¯†à®©à¯à®©à¯ˆ'));
  assert.ok(!s.includes('<f>'), 'no formulas are ever written');
  assert.ok(s.includes('=HYPERLINK(&quot;'), 'formula text stored as a plain inline string');
  assert.ok(s.includes(`<v>${excelSerial('2026-10-01T04:30:00Z')}</v>`), 'dates are real Excel dates');
  assert.equal((s.match(/<row /g) || []).length, 3);
  assert.ok(!/[\u0000-\u0008]/.test(s));
});

test('XLSX handles empty results (header only)', () => {
  const s = unzip(toXLSX(cols, []))['xl/worksheets/sheet1.xml'];
  assert.equal((s.match(/<row /g) || []).length, 1);
  assert.ok(!s.includes('autoFilter'));
});

test('XLSX handles 25k rows quickly', () => {
  const rows = Array.from({ length: 25000 }, (_, i) => ({ ...sample[0], member_id: 'YW-' + i }));
  const t = Date.now(), buf = toXLSX(cols, prepareRows(rows, cols));
  assert.ok(Date.now() - t < 5000);
  assert.equal((unzip(buf)['xl/worksheets/sheet1.xml'].match(/<row /g) || []).length, 25001);
});

test('crc32 known vector', () => { assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926); });
