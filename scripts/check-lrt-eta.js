/* Light Rail time_ch "-" on an arriving train is no estimate. It must not
   sort as arriving now or feed the leave-now hint. arrival_departure "D"
   with a blank time (or a 正在離開 / Departing label) is a train leaving
   now: it stays at null minutes so the leave-now hint still follows the
   next catchable train, but it sorts ahead of later estimates and keeps a
   platform slot. A blank "-" on a route that already has an estimate does
   not take that slot, and it is not shown as "-". A "D" row that still
   has a minute count stays a countdown. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');

const start = bundle.indexOf('function lrtMinutes(');
const end = bundle.indexOf('async function me(');
assert.ok(start >= 0 && end > start, 'lrtMinutes missing');
const { lrtMinutes, lrtBlank, lrtDeparting, lrtOrder, lrtKeep, lrtDepartNow, lrtShape } = new Function(
  `${bundle.slice(start, end)} return { lrtMinutes, lrtBlank, lrtDeparting, lrtOrder, lrtKeep, lrtDepartNow, lrtShape };`
)();

assert.strictEqual(lrtMinutes('-'), null);
assert.strictEqual(lrtMinutes('—'), null);
assert.strictEqual(lrtMinutes('－'), null);
assert.strictEqual(lrtMinutes(''), null);
assert.strictEqual(lrtMinutes(null), null);
assert.strictEqual(lrtMinutes('即將到站'), 0);
assert.strictEqual(lrtMinutes('即將抵達'), 0);
assert.strictEqual(lrtMinutes('Arriving'), 0);
assert.strictEqual(lrtMinutes('3 分鐘'), 3);
assert.strictEqual(lrtMinutes('12 mins'), 12);
assert.strictEqual(lrtMinutes('正在離開'), null);
assert.strictEqual(lrtMinutes('Departing'), null);
assert.strictEqual(lrtBlank('-'), true);
assert.strictEqual(lrtBlank('正在離開'), false);
assert.strictEqual(lrtBlank('5 分鐘'), false);
assert.strictEqual(lrtDeparting('正在離開'), true);
assert.strictEqual(lrtDeparting({ etaText: 'Departing' }), true);
assert.strictEqual(lrtDeparting({ etaText: '14 分鐘' }), false);
assert.strictEqual(lrtDeparting({ etaText: '-' }), false);
assert.strictEqual(lrtDepartNow({ arrival_departure: 'D', time_ch: '-', time_en: '-' }), true);
assert.strictEqual(lrtDepartNow({ arrival_departure: 'D', time_ch: '正在離開', time_en: 'Departing' }), true);
assert.strictEqual(lrtDepartNow({ time_en: 'Departing', time_ch: '-' }), true);
assert.strictEqual(lrtDepartNow({ arrival_departure: 'A', time_ch: '-', time_en: '-' }), false);
assert.strictEqual(lrtDepartNow({ arrival_departure: 'D', time_ch: '6 分鐘', time_en: '6 mins' }), false);
assert.strictEqual(lrtDepartNow({ arrival_departure: 'A', time_ch: '即將抵達' }), false);
assert.deepStrictEqual(
  lrtShape({ route_no: '614P', dest_ch: '屯門碼頭', arrival_departure: 'D', time_ch: '-', time_en: '-' }, '5'),
  { route: '614P', dest: '屯門碼頭', etaText: '正在離開', etaMinutes: null, platform: '5', blank: false }
);
assert.deepStrictEqual(
  lrtShape({ route_no: '505', dest_ch: '三聖', arrival_departure: 'D', time_ch: '7 分鐘', time_en: '7 mins' }, '5'),
  { route: '505', dest: '三聖', etaText: '7 分鐘', etaMinutes: 7, platform: '5', blank: false }
);
assert.deepStrictEqual(
  lrtShape({ route_no: '615', dest_ch: '元朗', arrival_departure: 'A', time_ch: '-', time_en: '-' }, '1'),
  { route: '615', dest: '元朗', etaText: '沒有預計', etaMinutes: null, platform: '1', blank: true }
);

const departing = { route: '610', etaText: '正在離開', etaMinutes: null };
const later = { route: '610', etaText: '14 分鐘', etaMinutes: 14 };
const sooner = { route: '614P', etaText: '2 分鐘', etaMinutes: 2 };
assert.deepStrictEqual([later, departing].sort(lrtOrder).map((row) => row.etaText), ['正在離開', '14 分鐘']);
assert.deepStrictEqual([later, sooner, departing].sort(lrtOrder).map((row) => row.etaMinutes), [null, 2, 14]);

const kept = lrtKeep([
  { route: '614P', platform: '2', etaText: '17 分鐘', etaMinutes: 17, blank: false },
  { route: '614P', platform: '2', etaText: '沒有預計', etaMinutes: null, blank: true },
  { route: '614', platform: '2', etaText: '沒有預計', etaMinutes: null, blank: true },
  { route: '614', platform: '2', etaText: '沒有預計', etaMinutes: null, blank: true },
  { route: '751', platform: '1', etaText: '沒有預計', etaMinutes: null, blank: true }
]);
assert.deepStrictEqual(kept.map((row) => `${row.platform}:${row.route}:${row.etaText}`), [
  '2:614P:17 分鐘',
  '2:614:沒有預計',
  '1:751:沒有預計'
]);
assert.ok(kept.every((row) => !('blank' in row)));

const live = lrtKeep([
  lrtShape({ route_no: '614P', dest_ch: '屯門碼頭', arrival_departure: 'D', time_ch: '-', time_en: '-' }, '5'),
  lrtShape({ route_no: '614P', dest_ch: '屯門碼頭', arrival_departure: 'D', time_ch: '16 分鐘', time_en: '16 mins' }, '5'),
  lrtShape({ route_no: '610', dest_ch: '元朗', arrival_departure: 'A', time_ch: '5 分鐘' }, '1'),
]).sort(lrtOrder);
assert.deepStrictEqual(live.map((row) => `${row.platform}:${row.route}:${row.etaText}`), [
  '5:614P:正在離開',
  '1:610:5 分鐘',
  '5:614P:16 分鐘',
]);

assert.ok(bundle.includes('function lrtDepartNow('));
assert.ok(bundle.includes('function lrtShape('));
assert.ok(bundle.includes('etaText:r?`正在離開`:i?`沒有預計`:n||`—`'));
assert.ok(bundle.includes('etaMinutes:r?null:lrtMinutes(n)'));
assert.ok(bundle.includes('let i=lrtShape(t,r.platform_id)'));
assert.ok(bundle.includes('return lrtKeep(n).sort(lrtOrder)'));
assert.ok(!bundle.includes('etaText:o?`沒有預計`:i||`—`'));
assert.ok(bundle.includes('rows:[...t].sort(lrtOrder)'));
assert.ok(!bundle.includes('||i===`-`?a=0'));
assert.ok(!bundle.includes('i===`-`?a=0'));

const lrtStart = bundle.indexOf('function $L(');
const lrtEnd = bundle.indexOf('function lrtMinutes(');
assert.ok(lrtStart >= 0 && lrtEnd > lrtStart);
const { $L } = new Function('$n', `${bundle.slice(lrtStart, lrtEnd)} return { $L };`)({
  '610': [
    { dest: '屯門碼頭', stops: [{ id: '10', name: '美樂' }, { id: '30', name: '屯門碼頭' }] },
    { dest: '元朗', stops: [{ id: '10', name: '美樂' }, { id: '20', name: '蝴蝶' }] },
  ],
  '505': [
    { dest: '三聖', stops: [{ id: '8', name: '兆康' }, { id: '9', name: '屯門' }, { id: '12', name: '三聖' }] },
  ],
});
assert.strictEqual($L('10', '610', '屯門碼頭'), '');
assert.strictEqual($L('10', '610', '元朗'), '蝴蝶');
assert.strictEqual($L('8', '505', '三聖'), '屯門');

console.log('lrt eta ok');
