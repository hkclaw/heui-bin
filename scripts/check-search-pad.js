/* Locks the search keypad delete key: one backspace per tap, long-press clears. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', `index-${rev}.css`), 'utf8');
const shell = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

const start = bundle.indexOf('function padApply(');
const end = bundle.indexOf('function Rt()');
assert.ok(start >= 0 && end > start, 'search pad source missing');
const { padApply, Lt } = new Function(`${bundle.slice(start, end)} return { padApply, Lt };`)();

assert.strictEqual(padApply('269C', 'backspace'), '269');
assert.strictEqual(padApply('269', 'C'), '269C');
assert.strictEqual(padApply('屯門', 'backspace'), '屯');
assert.strictEqual(padApply('屯', 'backspace'), '');
assert.strictEqual(padApply('', 'backspace'), '');
assert.strictEqual(padApply('99', '0'), '990');

const html = Lt();
const rows = html.split('route-pad-row').slice(1);
assert.strictEqual(rows.length, 5);
assert.ok(rows[3].includes('route-pad-zero'));
assert.ok(rows[3].includes('route-pad-spacer'));
assert.ok(rows[3].includes('data-pad-key="0"'));
assert.ok(rows[3].includes('data-pad-key="backspace"'));
assert.ok(rows[3].includes('class="route-pad-key route-pad-delete"'));
assert.ok(rows[3].includes('aria-label="刪除"'));
assert.ok(rows[3].includes('⌫'));
assert.ok(!rows[3].includes('>backspace<'));
for (const letter of ['C', 'D', 'X', 'M', 'P']) {
  assert.ok(rows[4].includes(`data-pad-key="${letter}"`));
  assert.ok(rows[4].includes('route-pad-letters'));
}
assert.ok(!rows[4].includes('backspace'));
assert.ok(bundle.includes('inputmode="text"'));
assert.ok(bundle.includes('id="q"'));
assert.ok(bundle.includes('let i=padApply(t.value,r)'));
assert.ok(bundle.includes('window.__padCleared=!0,$d(``,{saveRecent:!1})'));
assert.ok(bundle.includes('r===`backspace`&&window.__padCleared'));
assert.ok(bundle.includes('t.setPointerCapture(e.pointerId)'));

for (const sheet of [css, shell]) {
  assert.ok(sheet.includes('.route-pad-zero .route-pad-spacer{flex:0 0 calc(33.3333% - 2.66667px)'));
  assert.ok(sheet.includes('.route-pad-delete{font-size:1.1rem'));
  assert.ok(sheet.includes('.route-pad-key{border:1px solid var(--line)'));
}

console.log('search pad delete ok');
