/* Locks the opt-in alight reminder: distance, one-shot notify, route stops, copy. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const api = require('../assets/alight-remind.js');

assert.strictEqual(api.RADIUS_M, 250);
assert.ok(api.RADIUS_M >= 200 && api.RADIUS_M <= 300);
assert.notStrictEqual(api.NOTIFY_TAG, 'heui-bin-arrival');
assert.deepStrictEqual(api.MINUTES, [5, 10, 15, 20]);
assert.strictEqual(api.normalizeMinutes(10), 10);
assert.strictEqual(api.normalizeMinutes('5'), 5);
assert.strictEqual(api.normalizeMinutes(7), null);
assert.strictEqual(api.normalizeMinutes(3), null);

const memory = {
  data: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
  setItem(key, value) { this.data[key] = String(value); }
};
assert.strictEqual(api.readOff(memory), false);
api.writeOff(memory, true);
assert.strictEqual(memory.getItem(api.OFF_KEY), '1');
assert.strictEqual(api.readOff(memory), true);
api.writeOff(memory, false);
assert.strictEqual(api.readOff(memory), false);

const here = { lat: 22.345415, lng: 114.19264 };
const north = { lat: 22.345415 + 0.002, lng: 114.19264 };
const meters = api.haversine(here, north);
assert.ok(meters > 200 && meters < 250, '0.002° latitude is about 220 m, got ' + meters);
assert.ok(api.haversine(here, here) < 1);

assert.deepStrictEqual(api.consider(400, 20, 1), { streak: 0, notify: false });
assert.deepStrictEqual(api.consider(100, 500, 1), { streak: 0, notify: false });
assert.deepStrictEqual(api.consider(100, 20, 0), { streak: 1, notify: true });
assert.deepStrictEqual(api.consider(100, 120, 0), { streak: 1, notify: false });
assert.deepStrictEqual(api.consider(100, 120, 1), { streak: 2, notify: true });
assert.deepStrictEqual(api.consider(100, null, 1), { streak: 2, notify: true });
assert.strictEqual(api.alreadyNear(100, 40), true);
assert.strictEqual(api.alreadyNear(100, 400), false);
assert.strictEqual(api.alreadyNear(800, 20), false);

const state = { streak: 0, fired: false };
const first = api.stepWatch(state, 100, 30);
assert.strictEqual(first.notify, true);
const again = api.stepWatch({ streak: 0, fired: true }, 50, 10);
assert.strictEqual(again.notify, false);

const line = [
  { id: 'a', name: '竹園邨總站 (WT916)', lat: 22.345415, lng: 114.19264 },
  { id: 'b', name: '天虹小學 (WT418)', lat: 22.345076, lng: 114.190023 },
  { id: 'c', name: '馬仔坑遊樂場 (WT426)', lat: 22.344296, lng: 114.187763 },
  { id: 'd', name: '天虹小學 (WT150)', lat: 22.34, lng: 114.19 }
];
assert.deepStrictEqual(api.ahead(line, ['a'], null, null).map((s) => s.id), ['b', 'c', 'd']);
assert.deepStrictEqual(api.ahead(line, ['c'], null, null).map((s) => s.id), ['d']);
assert.deepStrictEqual(api.ahead(line, ['d'], null, null).map((s) => s.id), []);
const nearTwin = api.ahead(
  [{ id: 'x', name: '對面', lat: here.lat, lng: here.lng + 0.0004 }, { id: 'y', name: '遠', lat: 22.36, lng: 114.2 }],
  [],
  here,
  { unordered: true }
);
assert.deepStrictEqual(nearTwin.map((s) => s.id), ['y']);

const labels = api.chipLabels(line);
assert.strictEqual(labels[0], '竹園邨總站');
assert.ok(labels[1].includes('天虹小學'));
assert.ok(labels[1].includes('WT418'));
assert.ok(labels[3].includes('WT150'));

const root = path.join(__dirname, '..');
const kmb = JSON.parse(fs.readFileSync(path.join(root, 'data/kmb-stops.json'), 'utf8'));
const index = api.indexStops(kmb);
const outbound = api.materialize([
  { seq: '1', stop: '18492910339410B1' },
  { seq: '3', stop: '9583BCF159B682BA' },
  { seq: '2', stop: '9ED7E93749ABAE67' }
], index, 'kmb');
assert.deepStrictEqual(outbound.map((s) => s.id), ['18492910339410B1', '9ED7E93749ABAE67', '9583BCF159B682BA']);
const dirs = api.buildDirections([{ label: '往尖沙咀碼頭', stops: outbound, ordered: true }], ['18492910339410B1'], outbound[0]);
assert.strictEqual(dirs.length, 1);
assert.strictEqual(dirs[0].hasCurrent, true);
assert.deepStrictEqual(dirs[0].stops.map((s) => s.id), ['9ED7E93749ABAE67', '9583BCF159B682BA']);
assert.ok(dirs[0].stops[0].name.includes('天虹'));

const ctb = JSON.parse(fs.readFileSync(path.join(root, 'data/ctb-stops.json'), 'utf8'));
const ctbIndex = api.indexStops(ctb);
const ctbStop = api.materialize([{ seq: 1, stop: '001027' }], ctbIndex, 'ctb');
assert.strictEqual(ctbStop.length, 1);
assert.ok(ctbStop[0].name);

const lrtBook = JSON.parse(fs.readFileSync(path.join(root, 'data/lrt-next.json'), 'utf8'));
const lrtStops = JSON.parse(fs.readFileSync(path.join(root, 'data/lrt-stations.json'), 'utf8'));
const lrtIndex = api.indexStops(lrtStops);
const lrtDirs = api.lrtDirections(lrtBook, lrtIndex, '505', ['920'], null);
assert.ok(lrtDirs.some((dir) => dir.label.includes('兆康')));
const forward = lrtDirs.find((dir) => dir.hasCurrent);
assert.ok(forward, '505 from 三聖 keeps the direction that still has stops');
assert.notStrictEqual(forward.stops[0].id, '920');
assert.ok(forward.stops[0].name.includes('兆麟'));
assert.ok(lrtDirs.every((dir) => dir.stops.every((stop) => stop.id !== '920')));

const local = api.localCandidates(kmb, 'kmb', '1', ['18492910339410B1'], { lat: 22.345415, lng: 114.19264 });
assert.ok(local.length > 5);
assert.ok(local.every((stop) => stop.id !== '18492910339410B1'));
assert.ok(local.every((stop) => api.haversine({ lat: 22.345415, lng: 114.19264 }, stop) > api.NEAR_EXCLUDE_M));

assert.strictEqual(api.pageContext('#/eta/kmb/ABC/1', '').route, '1');
assert.strictEqual(api.pageContext('#/eta/kmb/ABC/1', '6').route, '6');
assert.strictEqual(api.pageContext('#/eta/tml/WKS', '').type, 'mtr');
assert.strictEqual(api.pageContext('#/route/505', '').page, 'route');
assert.strictEqual(api.offerType('mtr'), false);
assert.strictEqual(api.offerType('kmb'), true);

const hidden = api.viewModel({ disabled: true, page: 'eta', type: 'kmb', route: '1', directions: dirs });
assert.strictEqual(hidden.show, false);
assert.strictEqual(api.viewModel({ page: 'eta', type: 'mtr', route: 'TWL' }).show, false);
const pick = api.viewModel({ page: 'eta', type: 'kmb', route: '' });
assert.strictEqual(pick.show, true);
assert.strictEqual(pick.hint, api.PICK_ROUTE);
assert.strictEqual(pick.arm, false);
const idle = api.viewModel({ page: 'eta', type: 'kmb', route: '1', directions: dirs, dirIndex: 0 });
assert.strictEqual(idle.arm, true);
assert.strictEqual(idle.armEnabled, false);
assert.ok(idle.stops.some((stop) => stop.label.includes('天虹')));
const chosen = api.viewModel({ page: 'eta', type: 'kmb', route: '1', directions: dirs, selectedId: '9ED7E93749ABAE67' });
assert.strictEqual(chosen.armEnabled, true);
assert.ok(chosen.stops.find((stop) => stop.on).label.includes('天虹'));
const armed = api.viewModel({ phase: 'geo', route: '1', destName: '天虹小學 (WT418)' });
assert.strictEqual(armed.cancel, true);
assert.strictEqual(armed.useTime, true);
assert.ok(armed.note.includes('250'));
assert.ok(armed.note.includes('畫面要開住'));
assert.ok(armed.note.includes('天虹小學'));
const timed = api.viewModel({ phase: 'time', route: '505', destName: '兆康', minutes: 10 });
assert.ok(timed.note.includes('10'));
assert.ok(timed.note.includes('兆康'));
assert.strictEqual(timed.useTime, false);
const denied = api.viewModel({ page: 'eta', type: 'ctb', route: '1', directions: dirs, selectedId: dirs[0].stops[0].id, geoDenied: true });
assert.strictEqual(denied.arm, false);
assert.strictEqual(denied.minutes, true);
assert.strictEqual(denied.retryGeo, true);
assert.strictEqual(denied.note, api.TIME_HINT);
const messy = api.viewModel({
  page: 'eta',
  type: 'kmb',
  route: '960',
  directions: [{ label: '沿線站', stops: line, ordered: false, hasCurrent: false }]
});
assert.strictEqual(messy.hint, api.UNORDERED);

const html = api.renderBlock(chosen);
assert.ok(html.includes('落車提醒'));
assert.ok(html.includes(api.LIMIT_COPY));
assert.ok(html.includes('data-alight-arm'));
assert.ok(html.includes('data-alight-stop="9ED7E93749ABAE67"'));
assert.ok(!html.includes('data-action="arm-light"'));
assert.ok(!html.includes('分鐘前提醒'));
const armedHtml = api.renderBlock(armed);
assert.ok(armedHtml.includes('取消落車提醒'));
assert.ok(armedHtml.includes('改用倒數'));
assert.ok(armedHtml.includes('鎖屏'));
assert.ok(armedHtml.includes('位置唔會上傳'));
const minuteHtml = api.renderBlock(denied);
assert.ok(minuteHtml.includes('data-alight-min="10"'));
assert.ok(minuteHtml.includes('再試定位'));
assert.strictEqual(api.renderBlock(hidden), '');

assert.strictEqual(api.notifyBody('1', '天虹小學 (WT418)'), '1 快到天虹小學，準備落車');
assert.strictEqual(api.liveLabel({ mode: 'geo', dest: { name: '兆康' } }), '落車提醒緊 · 兆康');
assert.strictEqual(api.liveLabel(null), '');

const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', 'index-' + rev + '.js'), 'utf8');
const htmlShell = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
assert.ok(bundle.includes('id="alight-mount"'));
assert.ok(bundle.includes('data-alight-ids'));
assert.ok(bundle.includes('__heuiRawStops'));
assert.ok(bundle.includes('HeuiAlight.setStops'));
assert.ok(bundle.includes('HeuiAlight.sync'));
assert.ok(bundle.includes(api.LIMIT_COPY));
assert.ok(bundle.includes('data-alight-disable'));
assert.ok(bundle.includes('落車提醒'));
assert.ok(bundle.includes('定位只用嚟顯示附近車站同你開咗嘅落車提醒，唔會上傳。'));
assert.ok(bundle.includes('heui-bin-arrival'));
assert.ok(bundle.includes('data-action="arm-light"'));
assert.ok(bundle.includes('取消提醒'));
assert.ok(bundle.includes('tap-eta-lead-min-v1'));
assert.ok(htmlShell.includes('/assets/alight-remind.js'));
assert.ok(sw.includes('assets/alight-remind.js'));
assert.ok(sw.includes('assets/arrive-notify.js'));

console.log('alight ok');
