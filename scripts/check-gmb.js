/* Locks green-minibus stops, the 專線小巴 badge, and live ETA mapping. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', `index-${rev}.css`), 'utf8');
const shell = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const stops = JSON.parse(fs.readFileSync(path.join(root, 'data', 'gmb-stops.json'), 'utf8'));
const routes = JSON.parse(fs.readFileSync(path.join(root, 'data', 'gmb-routes.json'), 'utf8'));

assert.ok(Array.isArray(stops) && stops.length > 1500, `expected a full GMB stop list, got ${stops.length}`);
assert.ok(routes && typeof routes === 'object' && Object.keys(routes).length > 400);

const ids = new Set();
let withCoord = 0;
for (const stop of stops) {
  assert.strictEqual(stop.type, 'gmb');
  assert.match(String(stop.id), /^\d+$/);
  assert.ok(!ids.has(stop.id), `duplicate stop ${stop.id}`);
  ids.add(stop.id);
  assert.ok(stop.name_tc);
  assert.ok(stop.name_en);
  assert.ok(Array.isArray(stop.routes) && stop.routes.length > 0);
  for (const route of stop.routes) assert.match(route, /^[A-Za-z0-9]+$/);
  if (stop.aka) {
    assert.ok(Array.isArray(stop.aka) && stop.aka.length > 0 && stop.aka.length <= 8);
  }
  if (stop.lat != null || stop.lng != null) {
    assert.ok(stop.lat > 22 && stop.lat < 23);
    assert.ok(stop.lng > 113 && stop.lng < 115);
    withCoord += 1;
  }
}
assert.ok(withCoord > stops.length * 0.9, `coordinates missing on too many stops (${withCoord}/${stops.length})`);
assert.ok(stops.some((stop) => stop.name_tc.includes('數碼港') && stop.routes.includes('69')));

assert.ok(bundle.includes('gmb:`專線小巴`'));
assert.ok(!bundle.includes('label:`專線小巴`'));
assert.ok(bundle.includes('https://data.etagmb.gov.hk/eta/stop/'));
assert.ok(bundle.includes('/data/gmb-stops.json'));
assert.ok(bundle.includes('/data/gmb-routes.json'));
assert.ok(bundle.includes('t===`kmb`||t===`ctb`||t===`nlb`||t===`gmb`||t===`lrt`||t===`tml`||t===`mtr`'));
assert.ok(bundle.includes('case`gmb`:return gmbStop(e)'));
assert.ok(bundle.includes('a.type===`gmb`?`${a.type}:${a.id}`'));
for (const sheet of [css, shell]) assert.ok(sheet.includes('.chip-gmb'));
assert.ok(sw.includes('data/gmb-stops.json'));
assert.ok(sw.includes('data/gmb-routes.json'));
assert.ok(sw.includes('etagmb'));
assert.ok(sw.includes('etagmb\\.gov\\.hk\\/.*/i,new e.NetworkOnly'), 'GMB ETA must not be replayed from the SW cache as a fresh response');

const start = bundle.indexOf('/* GMB_BEGIN */');
const end = bundle.indexOf('/* GMB_END */');
assert.ok(start >= 0 && end > start);
const { gmbRows, gmbLabel } = new Function(
  `${bundle.slice(start, end)}\nreturn { gmbRows, gmbLabel };`
)();

const book = { '2000410:1': { code: '69', dest: '鰂魚涌' } };
assert.deepStrictEqual(gmbLabel(book, { route_id: 2000410, route_seq: 1 }), { code: '69', dest: '鰂魚涌' });
assert.strictEqual(gmbLabel({}, { route_id: 9, route_seq: 2 }).code, '9');

const NOW = Date.parse('2026-10-19T15:00:00+08:00');
const deps = {
  k: (value) => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  },
  A: (ms) => (ms == null ? null : Math.max(0, Math.round((ms - NOW) / 60000))),
  de: (mins) => (mins == null ? '—' : mins <= 0 ? '即將到站' : `${mins} 分鐘`),
  O: () => '15:06',
};
const rows = gmbRows([
  {
    enabled: true,
    route_id: 2000410,
    route_seq: 1,
    stop_seq: 1,
    eta: [
      { eta_seq: 1, diff: 6, timestamp: '2026-10-19T15:06:00+08:00', remarks_tc: null },
      { eta_seq: 2, diff: 0, timestamp: '2026-10-19T15:00:00+08:00', remarks_tc: '未開出' },
    ],
  },
  { enabled: false, route_id: 2000802, route_seq: 1, stop_seq: 1, description_tc: '暫停' },
  { enabled: true, route_id: 2000963, route_seq: 1, stop_seq: 3, eta: [] },
], book, deps);

assert.strictEqual(rows.length, 4);
const soon = rows.find((row) => row.route === '69' && row.etaMinutes === 6);
assert.ok(soon);
assert.strictEqual(soon.dest, '鰂魚涌');
assert.match(soon.etaText, /6 分鐘/);
const due = rows.find((row) => row.route === '69' && row.etaMinutes === 0);
assert.ok(due);
assert.match(due.etaText, /即將到站/);
assert.strictEqual(due.remark, '未開出');
const paused = rows.find((row) => row.route === '2000802');
assert.ok(paused);
assert.strictEqual(paused.etaText, '暫停');
assert.strictEqual(paused.etaMinutes, null);
const empty = rows.find((row) => row.route === '2000963');
assert.strictEqual(empty.etaText, '暫時沒有班次');
const mixed = gmbRows([
  { enabled: true, route_id: 2000410, route_seq: 1, stop_seq: 1, eta: [{ eta_seq: 1, diff: 4, timestamp: '2026-10-19T15:04:00+08:00', remarks_tc: null }] },
  { enabled: true, route_id: 2000410, route_seq: 1, stop_seq: 40, eta: [] },
], book, deps);
assert.strictEqual(mixed.length, 1);
assert.strictEqual(mixed[0].etaMinutes, 4);

const ueStart = bundle.indexOf('function b(e){let t=e.replace(/巿/g');
const ueEnd = bundle.indexOf('function modeHit(e,t)');
assert.ok(ueStart >= 0 && ueEnd > ueStart);
const { ue } = new Function(`${bundle.slice(ueStart, ueEnd)} return { ue };`)();
const sameName = ue([
  { type: 'gmb', id: '1', name_tc: '港鐵站', name_en: 'Station A', routes: ['1'], lat: 22.1, lng: 114.1 },
  { type: 'gmb', id: '2', name_tc: '港鐵站', name_en: 'Station B', routes: ['2'], lat: 22.4, lng: 114.2 },
]);
assert.strictEqual(sameName.length, 2);
assert.notStrictEqual(sameName[0].id, sameName[1].id);
const merged = ue([
  { type: 'kmb', id: 'a', name_tc: '摩士公園', name_en: 'Morse Park', routes: ['1'], lat: 22.1, lng: 114.1, bound_tc: '往尖沙咀' },
  { type: 'kmb', id: 'b', name_tc: '摩士公園 (對面)', name_en: 'Morse Park', routes: ['2'], lat: 22.1004, lng: 114.1, bound_tc: '往觀塘' },
]);
assert.strictEqual(merged.length, 1);
assert.deepStrictEqual(merged[0].memberIds.slice().sort(), ['a', 'b']);

// Same display name in two districts used to become one card: the pin sat
// between them and the ETA mixed both places. Opposite poles still merge.
const distant = ue([
  { type: 'kmb', id: 'yl1', name_tc: '水邊村 (YL259)', name_en: 'SHUI PIN TSUEN', routes: ['68'], lat: 22.444444, lng: 114.021349, bound_tc: '往荃灣' },
  { type: 'kmb', id: 'yl2', name_tc: '水邊村 (YL260)', name_en: 'SHUI PIN TSUEN', routes: ['69'], lat: 22.444568, lng: 114.02114, bound_tc: '往機場' },
  { type: 'kmb', id: 'tk1', name_tc: '水邊村 (TK262)', name_en: 'SHUI BIN TSUEN', routes: ['91'], lat: 22.321383, lng: 114.268881, bound_tc: '往鑽石山站' },
  { type: 'kmb', id: 'tk2', name_tc: '水邊村 (TK275)', name_en: 'SHUI BIN TSUEN', routes: ['98'], lat: 22.321881, lng: 114.26906, bound_tc: '往寶林' },
]);
assert.strictEqual(distant.length, 2);
assert.deepStrictEqual(distant[0].memberIds.slice().sort(), ['yl1', 'yl2']);
assert.deepStrictEqual(distant[1].memberIds.slice().sort(), ['tk1', 'tk2']);
assert.ok(Math.abs(distant[0].lat - 22.4445) < 0.001);
assert.ok(Math.abs(distant[1].lat - 22.3216) < 0.001);
assert.ok(!distant[0].routes.includes('91'));
assert.ok(!distant[1].routes.includes('68'));

const eStart = bundle.indexOf('function E(e,t,n){');
const eEnd = bundle.indexOf('var D=`Asia/Hong_Kong`');
assert.ok(eStart > ueEnd && eEnd > eStart);
const { E } = new Function(`${bundle.slice(ueStart, ueEnd)}${bundle.slice(eStart, eEnd)} return { E };`)();
const raw = [
  { type: 'kmb', id: 'yl1', name_tc: '水邊村 (YL259)', lat: 22.444444, lng: 114.021349 },
  { type: 'kmb', id: 'tk1', name_tc: '水邊村 (TK262)', lat: 22.321383, lng: 114.268881 },
];
const looked = E(raw, 'kmb', 'tk1');
assert.deepStrictEqual(looked.memberIds, ['tk1']);
assert.ok(looked.lat < 22.4, 'opening the Tai Po pole must not resolve to the Yuen Long card');
assert.strictEqual(merged[0].poles.length, 2);
assert.deepStrictEqual(merged[0].poles.map((pole) => pole.id).sort(), ['a', 'b']);
assert.strictEqual(distant[0].poles.length, 2);
assert.strictEqual(distant[1].poles.length, 2);

const estates = ue([
  { type: 'lrt', id: '100', name_tc: '大興(北)', name_en: 'Tai Hing (North)', routes: ['610'], lat: 22.4, lng: 113.97 },
  { type: 'lrt', id: '101', name_tc: '大興(南)', name_en: 'Tai Hing (South)', routes: ['610'], lat: 22.4002, lng: 113.97 },
]);
assert.strictEqual(estates.length, 2);
assert.notStrictEqual(estates[0].id, estates[1].id);

console.log(`gmb ok (${stops.length} stops, ${withCoord} with coordinates)`);
