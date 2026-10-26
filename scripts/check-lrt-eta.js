/* Light Rail time_ch "-" is no estimate. It must not sort as arriving now
   or feed the leave-now hint. A departing train stays at null minutes so
   the leave-now hint still follows the next catchable train, but it sorts
   ahead of later estimates and keeps a platform slot. A blank "-" does not
   sit beside a real estimate for the same route, and it is not shown as "-". */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');

const start = bundle.indexOf('function lrtMinutes(');
const end = bundle.indexOf('async function me(');
assert.ok(start >= 0 && end > start, 'lrtMinutes missing');
const { lrtMinutes, lrtBlank, lrtDeparting, lrtOrder, lrtKeep } = new Function(
  `${bundle.slice(start, end)} return { lrtMinutes, lrtBlank, lrtDeparting, lrtOrder, lrtKeep };`
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

assert.ok(bundle.includes('a=lrtMinutes(i)'));
assert.ok(bundle.includes('etaText:o?`沒有預計`:i||`—`'));
assert.ok(bundle.includes('return lrtKeep(n).sort(lrtOrder)'));
assert.ok(bundle.includes('rows:[...t].sort(lrtOrder)'));
assert.ok(!bundle.includes('||i===`-`?a=0'));
assert.ok(!bundle.includes('i===`-`?a=0'));

console.log('lrt eta ok');
