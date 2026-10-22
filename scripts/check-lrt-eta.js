/* Light Rail time_ch "-" is no estimate. It must not sort as arriving now
   or feed the leave-now hint. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');

const start = bundle.indexOf('function lrtMinutes(');
const end = bundle.indexOf('async function me(');
assert.ok(start >= 0 && end > start, 'lrtMinutes missing');
const { lrtMinutes } = new Function(`${bundle.slice(start, end)} return { lrtMinutes };`)();

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
assert.ok(bundle.includes('a=lrtMinutes(i)'));
assert.ok(!bundle.includes('||i===`-`?a=0'));
assert.ok(!bundle.includes('i===`-`?a=0'));

console.log('lrt eta ok');
