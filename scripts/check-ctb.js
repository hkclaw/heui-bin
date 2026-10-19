/* Locks the Citybus catalogue and joint-op ETA remarks. The filter chip is the shared 巴士 union. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', `index-${rev}.css`), 'utf8');
const shell = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const stops = JSON.parse(fs.readFileSync(path.join(root, 'data', 'ctb-stops.json'), 'utf8'));
const routes = JSON.parse(fs.readFileSync(path.join(root, 'data', 'ctb-routes.json'), 'utf8'));

assert.ok(Array.isArray(stops) && stops.length > 2000, `expected a full CTB stop list, got ${stops.length}`);
assert.ok(routes['1'] && routes['1'].d && routes['1'].de);
const ids = new Set();
for (const stop of stops) {
  assert.strictEqual(stop.type, 'ctb');
  assert.match(stop.id, /^\d{6}$/);
  assert.ok(!ids.has(stop.id), `duplicate stop ${stop.id}`);
  ids.add(stop.id);
  assert.ok(stop.name_tc);
  assert.ok(stop.name_en);
  assert.ok(Array.isArray(stop.routes) && stop.routes.length > 0);
  for (const route of stop.routes) {
    assert.match(route, /^[A-Za-z0-9]+$/);
    assert.ok(routes[route], `stop ${stop.id} route ${route} missing from ctb-routes`);
  }
  if (stop.lat != null || stop.lng != null) {
    assert.ok(stop.lat > 22 && stop.lat < 23);
    assert.ok(stop.lng > 113 && stop.lng < 115);
  }
}
assert.ok(!bundle.includes('NWFB') && !bundle.includes('nwfb'));
assert.ok(!JSON.stringify(stops).includes('NWFB'));
assert.ok(bundle.includes('ctb:`城巴`'));
assert.ok(!bundle.includes('label:`城巴`'));
assert.ok(bundle.includes('https://rt.data.gov.hk/v1/transport/batch/stop-eta/CTB/'));
assert.ok(bundle.includes('https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/'));
assert.ok(bundle.includes('t===`kmb`||t===`ctb`||t===`lrt`||t===`tml`||t===`mtr`'));
assert.ok(bundle.includes('/data/ctb-stops.json'));
assert.ok(bundle.includes('/data/ctb-routes.json'));
for (const sheet of [css, shell]) {
  assert.ok(sheet.includes('.mode-chip-bus.on'));
  assert.ok(!sheet.includes('.mode-chip-ctb.on'));
  assert.ok(sheet.includes('.chip-ctb'));
}
assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('data/ctb-stops.json'));
assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('data/ctb-routes.json'));

const start = bundle.indexOf('/* CTB_BEGIN */');
const end = bundle.indexOf('/* CTB_END */');
assert.ok(start >= 0 && end > start);
const api = new Function(`${bundle.slice(start, end)}; return { ctbNorm, ctbRemark, ctbDest, ctbMap };`);
const { ctbRemark, ctbDest, ctbMap } = api();

assert.strictEqual(ctbRemark('KMB Cycle'), '九巴時段');
assert.strictEqual(ctbRemark('kmb cycle'), '九巴時段');
assert.strictEqual(ctbRemark(''), '');
assert.strictEqual(ctbRemark('Last bus departed'), 'Last bus departed');

const book = { '619': { o: '中環(港澳碼頭)', d: '順利邨', oe: 'Central (Macao Ferry)', de: 'Shun Lee Estate' } };
assert.strictEqual(ctbDest('619', 'O', 'Shun Lee Estate', book), '順利邨');
assert.strictEqual(ctbDest('619', 'I', 'Central (Macao Ferry)', book), '中環(港澳碼頭)');
assert.strictEqual(ctbDest('619', 'O', 'Admiralty only', book), 'Admiralty only');
assert.strictEqual(ctbDest('619', 'O', 'Central', book), 'Central');
assert.strictEqual(ctbDest('1M', 'O', 'Wong Nai Chung Gap', {
  '1M': { o: '會展站', d: '跑馬地／黃泥涌峽', oe: 'Exhibition Centre Station', de: 'Happy Valley / Wong Nai Chung Gap' },
}), '黃泥涌峽');
assert.strictEqual(ctbDest('109', 'O', 'Ho Man Tin', {
  '109': { o: '中環 (港澳碼頭)', d: '何文田邨', oe: 'Central (Macao Ferry)', de: 'Ho Man Tin Estate' },
}), '何文田邨');
assert.strictEqual(ctbDest('2', 'I', 'Sai Wan Ho (Grand Promenade)', {
  '2': { o: '嘉亨灣', d: '中環 (港澳碼頭)', oe: 'Grand Promenade', de: 'Central (Macao Ferry)' },
}), '嘉亨灣');
assert.strictEqual(ctbDest('720', 'O', 'Central (Macao Ferry)', {
  '720': { o: '嘉亨灣', d: '中環 (港澳碼頭 / 永和街)', oe: 'Grand Promenade', de: 'Central (Macao Ferry / Wing Wo Street)' },
}), '中環 港澳碼頭');

const NOW = Date.parse('2026-10-19T21:00:00+08:00');
const deps = {
  k: (value) => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  },
  A: (ms) => (ms == null ? null : Math.max(0, Math.round((ms - NOW) / 60000))),
  de: (mins) => (mins == null ? '—' : mins <= 0 ? '即將到站' : `${mins} 分鐘`),
  O: () => '21:10',
};
const rows = ctbMap([
  { co: 'CTB', route: '619', dir: 'O', eta_seq: 1, eta: '', rmk: 'KMB Cycle', dest: 'Shun Lee Estate' },
  { co: 'CTB', route: '619', dir: 'O', eta_seq: 2, eta: '', rmk: 'KMB Cycle', dest: 'Shun Lee Estate' },
  { co: 'CTB', route: '619', dir: 'O', eta_seq: 3, eta: '', rmk_en: 'KMB Cycle', dest_en: 'Shun Lee Estate' },
  { co: 'NWFB', route: '619', dir: 'O', eta_seq: 1, eta: '2026-10-19T21:05:00+08:00', rmk: '', dest: 'Shun Lee Estate' },
  { co: 'CTB', route: '1', dir: 'I', eta_seq: 1, eta: '2026-10-19T21:10:00+08:00', rmk: '', dest_tc: '中環(港澳碼頭)', dest_en: 'Central (Macao Ferry)' },
], book, deps);

assert.strictEqual(rows.length, 2);
const joint = rows.find((row) => row.route === '619');
assert.ok(joint);
assert.strictEqual(joint.etaMinutes, null);
assert.strictEqual(joint.etaText, '九巴時段');
assert.strictEqual(joint.remark, '九巴時段');
assert.strictEqual(joint.dest, '順利邨');
assert.ok(!/\d+\s*分鐘/.test(joint.etaText));
const live = rows.find((row) => row.route === '1');
assert.strictEqual(live.dest, '中環(港澳碼頭)');
assert.strictEqual(live.etaMinutes, 10);
assert.match(live.etaText, /10 分鐘/);

console.log(`ctb ok (${stops.length} stops)`);
