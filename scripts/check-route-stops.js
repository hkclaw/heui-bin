/* Locks the ordered route-stop list on a selected KMB or Citybus route. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const sheets = [
  fs.readFileSync(path.join(root, 'assets', `index-${rev}.css`), 'utf8'),
  fs.readFileSync(path.join(root, 'styles.css'), 'utf8'),
  fs.readFileSync(path.join(root, 'assets', 'eta-details.css'), 'utf8'),
];

assert.ok(bundle.includes('https://data.etabus.gov.hk/v1/transport/kmb/route-stop/'));
assert.ok(bundle.includes('https://data.etabus.gov.hk/v1/transport/kmb/route/'));
assert.ok(bundle.includes('https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/'));
assert.ok(bundle.includes('沿途車站'));
assert.ok(bundle.includes('data-route-stops'));
assert.ok(bundle.includes('data-rs-dir'));
assert.ok(bundle.includes('data-rs-retry'));
assert.ok(bundle.includes('rsOpen&&rsEnsure()'));
assert.ok(!bundle.includes('await rsEnsure'));
assert.ok(bundle.includes('data-action="share-station"'));
assert.ok(bundle.includes('data-pin-route'));
assert.ok(bundle.includes('if(e===`kmb`||e===`ctb`)return $k(t,n)'));
for (const sheet of sheets) {
  assert.ok(sheet.includes('.rs-panel'));
  assert.ok(sheet.includes('.rs-row.is-here'));
  assert.ok(sheet.includes('.eta-stops'));
}

const start = bundle.indexOf('/* RS_BEGIN */');
const end = bundle.indexOf('/* RS_PURE_END */');
assert.ok(start >= 0 && end > start);
const api = new Function(`${bundle.slice(start, end)}; return { rsDirWord, rsKmbStopUrl, rsKmbRouteUrl, rsCtbStopUrl, rsSortStops, rsLabel, rsPick, rsPreferDir, rsHere, rsRows, rsListHtml, rsPanelHtml };`);
const {
  rsDirWord, rsKmbStopUrl, rsKmbRouteUrl, rsCtbStopUrl,
  rsSortStops, rsLabel, rsPick, rsPreferDir, rsHere, rsRows, rsListHtml, rsPanelHtml,
} = api();

assert.strictEqual(rsDirWord('O'), 'outbound');
assert.strictEqual(rsDirWord('I'), 'inbound');
assert.strictEqual(rsKmbStopUrl('2X', 'O', '1'), 'https://data.etabus.gov.hk/v1/transport/kmb/route-stop/2X/outbound/1');
assert.strictEqual(rsKmbRouteUrl('1', 'I', '1'), 'https://data.etabus.gov.hk/v1/transport/kmb/route/1/inbound/1');
assert.strictEqual(rsCtbStopUrl('619', 'I'), 'https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/619/inbound');
assert.strictEqual(rsLabel('尖沙咀碼頭', 'O'), '往尖沙咀碼頭');
assert.strictEqual(rsLabel('', 'I'), '回程');

const sorted = rsSortStops([
  { stop: 'B', seq: '3' },
  { stop: '', seq: '9' },
  { stop: 'A', seq: '1' },
  null,
  { stop: 'C', seq: '2' },
]);
assert.deepStrictEqual(sorted.map((row) => row.id), ['A', 'C', 'B']);
assert.deepStrictEqual(sorted.map((row) => row.seq), [1, 2, 3]);

const dirs = [
  { key: 'O', dest: '尖沙咀碼頭', label: '往尖沙咀碼頭', stops: [{ id: 'A', seq: 1 }, { id: 'HERE', seq: 2 }] },
  { key: 'I', dest: '竹園邨', label: '往竹園邨', stops: [{ id: 'Z', seq: 1 }, { id: 'HERE', seq: 2 }] },
];
assert.strictEqual(rsPick(dirs, 'I').key, 'I');
assert.strictEqual(rsPick(dirs, null).key, 'O');
assert.strictEqual(rsPreferDir([
  { route: '1', dir: 'O', etaMinutes: 12 },
  { route: '1', dir: 'I', etaMinutes: 3 },
  { route: '2', dir: 'O', etaMinutes: 1 },
], '1'), 'I');
assert.strictEqual(rsPreferDir([{ route: '1', etaMinutes: 1 }], '1'), null);

const current = { id: 'CANON', memberIds: ['HERE', 'CANON'] };
assert.strictEqual(rsHere('HERE', current), true);
assert.strictEqual(rsHere('NOPE', current), false);

const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
const resolve = (type, id) => (id === 'HERE'
  ? { name: '摩士公園', navId: 'CANON' }
  : id === 'A'
    ? { name: '<竹園>', navId: 'A' }
    : { name: '', navId: id });
const rows = rsRows(dirs[0].stops, 'kmb', '1', current, resolve);
assert.strictEqual(rows[1].here, true);
assert.strictEqual(rows[1].href, '/eta/kmb/CANON/1');
assert.strictEqual(rows[0].href, '/eta/kmb/A/1');

const html = rsListHtml(dirs[0], 'kmb', '1', current, resolve, esc);
assert.ok(html.includes('本站'));
assert.ok(html.includes('is-here'));
assert.ok(html.includes('data-nav="/eta/kmb/CANON/1"'));
assert.ok(html.includes('&lt;竹園&gt;'));
assert.ok(!html.includes('<竹園>'));

const loading = rsPanelHtml({ status: 'loading', dirs: [] }, 'kmb', '1', current, null, resolve, esc);
assert.ok(loading.includes('載入沿途車站'));
const failed = rsPanelHtml({ status: 'error', error: '網絡錯誤（500）', dirs: [] }, 'ctb', '619', current, null, resolve, esc);
assert.ok(failed.includes('無法載入沿途車站'));
assert.ok(failed.includes('data-rs-retry'));
assert.ok(failed.includes('網絡錯誤（500）'));
const empty = rsPanelHtml({ status: 'empty', dirs: [] }, 'kmb', '1', current, null, resolve, esc);
assert.ok(empty.includes('暫時沒有沿途車站'));
const panel = rsPanelHtml({ status: 'ok', dirs }, 'kmb', '1', current, 'I', resolve, esc);
assert.ok(panel.includes('data-rs-dir="I"'));
assert.ok(panel.includes('往竹園邨'));
assert.ok(panel.includes('aria-selected="true"'));

console.log('route-stops ok');
