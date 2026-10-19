/* Locks the New Lantao Bus catalogue, batch ETA mapping, and the 巴士 union. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', `index-${rev}.css`), 'utf8');
const shell = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const stops = JSON.parse(fs.readFileSync(path.join(root, 'data', 'nlb-stops.json'), 'utf8'));
const book = JSON.parse(fs.readFileSync(path.join(root, 'data', 'nlb-routes.json'), 'utf8'));

assert.ok(Array.isArray(stops) && stops.length > 200, `expected a full NLB stop list, got ${stops.length}`);
assert.ok(book.routes && book.byStop && book.places);
const routeNos = new Set(Object.values(book.routes).map((row) => row.no));
const ids = new Set();
for (const stop of stops) {
  assert.strictEqual(stop.type, 'nlb');
  assert.match(stop.id, /^\d+$/);
  assert.ok(!ids.has(stop.id), `duplicate stop ${stop.id}`);
  ids.add(stop.id);
  assert.ok(stop.name_tc);
  assert.ok(stop.name_en);
  assert.ok(Array.isArray(stop.routes) && stop.routes.length > 0);
  for (const route of stop.routes) {
    assert.match(route, /^[A-Za-z0-9]+$/);
    assert.ok(routeNos.has(route), `stop ${stop.id} route ${route} missing from nlb-routes`);
  }
  assert.ok(Array.isArray(book.byStop[stop.id]) && book.byStop[stop.id].length > 0);
  assert.ok(stop.lat > 22 && stop.lat < 22.6);
  assert.ok(stop.lng > 113.8 && stop.lng < 114.3);
}
const muiWo = stops.find((stop) => stop.id === '1');
assert.ok(muiWo && muiWo.name_tc === '梅窩碼頭');
assert.ok(book.places.tongfukcorrectionalinstitution === '塘福懲教所');
assert.ok(book.places.muiwooldtown === '梅窩舊墟');

assert.ok(bundle.includes('nlb:`新大嶼山`'));
assert.ok(!bundle.includes('label:`新大嶼山`'));
assert.ok(bundle.includes('https://rt.data.gov.hk/v1/transport/batch/stop-eta/NLB/'));
assert.ok(bundle.includes('https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals'));
assert.ok(bundle.includes('t===`kmb`||t===`ctb`||t===`nlb`||t===`gmb`||t===`lrt`||t===`tml`||t===`mtr`'));
assert.ok(bundle.includes('function modeHit(e,t){return t==null||(t===`bus`?e===`kmb`||e===`ctb`||e===`nlb`||e===`gmb`:e===t)}'));
assert.ok(bundle.includes('/data/nlb-stops.json'));
assert.ok(bundle.includes('/data/nlb-routes.json'));
assert.ok(bundle.includes('case`nlb`:return t.length===1?nlbStop(t[0])'));
assert.ok(bundle.includes('t!==`kmb`&&t!==`ctb`&&t!==`nlb`&&t!==`gmb`&&t!==`lrt`&&t!==`mtr`'));
assert.ok(bundle.includes('i!==`kmb`&&i!==`ctb`&&i!==`nlb`&&i!==`gmb`&&i!==`lrt`&&i!==`mtr`'));
assert.ok(bundle.includes('而家走趕得切'));
assert.ok(bundle.includes('return rankNearby(a,{limit:n,favorites:o,recents:s,pins:c})'));
const batchFn = bundle.slice(bundle.indexOf('async function nlbBatch'), bundle.indexOf('async function nlbNative'));
assert.ok(!batchFn.includes('padStart'));
for (const sheet of [css, shell]) {
  assert.ok(sheet.includes('.chip-nlb'));
  assert.ok(sheet.includes('.mode-chip-bus.on'));
  assert.ok(!sheet.includes('.mode-chip-nlb'));
}
assert.ok(sw.includes('data/nlb-stops.json'));
assert.ok(sw.includes('data/nlb-routes.json'));

const start = bundle.indexOf('/* NLB_BEGIN */');
const end = bundle.indexOf('/* NLB_END */');
assert.ok(start >= 0 && end > start);
const { nlbDest, nlbMap } = new Function(`${bundle.slice(start, end)}; return { nlbDest, nlbMap };`)();

const NOW = Date.parse('2026-10-19T21:00:00+08:00');
const deps = {
  k: (value) => {
    if (!value) return null;
    const text = String(value).trim();
    const parsed = Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text.includes('T') ? text : text.replace(' ', 'T')}+08:00`);
    return Number.isNaN(parsed) ? null : parsed;
  },
  A: (ms) => (ms == null ? null : Math.max(0, Math.round((ms - NOW) / 60000))),
  de: (mins) => (mins == null ? '—' : mins <= 0 ? '即將到站' : `${mins} 分鐘`),
  O: () => '22:16',
};
const boiler = 'Actual arrival time can be affected by traffic conditions, please wait at the bus stop in advance; Scheduled arrival time is calculated from timetable, actual departure time may change subject to operational adjustment';

const quiet = nlbMap([
  { co: 'NLB', route: '11', dest: 'Tung Chung Station Bus Terminus', eta: '', rmk: 'This route has no departure via this stop in next 60 mins' },
  { co: 'NLB', route: '11', dest: 'Tung Chung Station Bus Terminus', eta: '', rmk: 'This route has no departure via this stop in next 60 mins' },
], book, deps);
assert.strictEqual(quiet.length, 1);
assert.strictEqual(quiet[0].dest, '東涌站巴士總站');
assert.strictEqual(quiet[0].etaText, '未來60分鐘沒有班次');
assert.strictEqual(quiet[0].etaMinutes, null);
assert.strictEqual(quiet[0].remark, undefined);

const live = nlbMap([
  { co: 'NLB', route: '11', dest: 'Tung Chung Station Bus Terminus', eta: '2026-10-19T22:16:38+08:00', rmk: boiler, routeVariantName: 'Via: Tong Fuk Correctional Institution' },
  { co: 'NLB', route: '11', dest: 'Tung Chung Station Bus Terminus', eta: '', rmk: 'This route has no departure via this stop in next 60 mins' },
  { co: 'CTB', route: '11', dest: 'Robinson Road', eta: '2026-10-19T22:16:38+08:00' },
], book, deps);
assert.strictEqual(live.length, 1);
assert.strictEqual(live[0].dest, '東涌站巴士總站');
assert.strictEqual(live[0].etaMinutes, 77);
assert.match(live[0].etaText, /77 分鐘/);
assert.strictEqual(live[0].remark, '經: 塘福懲教所');
assert.ok(!live[0].etaText.includes('Actual arrival'));

const via = nlbMap([
  { co: 'NLB', route: '1', dest: 'Tai O', eta: '2026-10-19T22:09:13+08:00', rmk: boiler, routeVariantName: 'Via: Mui Wo Old Town' },
], book, deps);
assert.strictEqual(via[0].dest, '大澳');
assert.strictEqual(via[0].remark, '經: 梅窩舊墟');

const variant = nlbMap([
  { co: 'NLB', route: '4', dest: 'Tong Fuk (to Shui Hau)', eta: '', rmk: '此路線於未來60分鐘沒有班次途經本站<br />預定班次' },
], book, deps);
assert.strictEqual(variant[0].dest, '塘福 (至水口)');
assert.strictEqual(variant[0].etaText, '未來60分鐘沒有班次');

assert.strictEqual(nlbDest('4', 'Tong Fuk (to Shui Hau)', {
  routes: { x: { no: '9', o: '甲', d: '乙', oe: 'A', de: 'B' } },
  places: { tongfuk: '塘福', shuihau: '水口' },
}), '塘福（往水口）');
assert.strictEqual(nlbDest('38', 'Tung Chung Station Bus Terminus (Circular)', book), '東涌站巴士總站 (循環線)');
assert.strictEqual(nlbDest('1', '大澳', book), '大澳');

const pair = nlbMap([
  { co: 'NLB', route: '1', dest: 'Mui Wo Ferry Pier', eta: '2026-10-19T22:19:10+08:00', rmk: '' },
  { co: 'NLB', route: '1', dest: 'Mui Wo Ferry Pier', eta: '2026-10-19T23:03:47+08:00', rmk: '' },
], book, deps);
assert.strictEqual(pair.length, 2);
assert.deepStrictEqual(pair.map((row) => row.etaMinutes), [79, 124]);
assert.strictEqual(pair[0].dest, '梅窩碼頭');

console.log(`nlb ok (${stops.length} stops)`);
