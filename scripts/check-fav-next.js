/* A saved stop shows one next departure. The tall preview stays off the card. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');

const favCard = bundle.slice(bundle.lastIndexOf('function Ft(e){return`'), bundle.indexOf('function padApply'));
assert.ok(favCard.includes('data-fav-next='));
assert.ok(favCard.includes('aria-busy="true"'));
assert.ok(!favCard.includes('fav-eta'));
assert.ok(!favCard.includes('載入班次'));

assert.ok(bundle.includes('setInterval(()=>pinSync(e)'));
assert.ok(bundle.includes('favTick=window.setInterval(()=>favNextSync(e),2e4)'));
assert.ok(bundle.includes('favTick!==null&&(window.clearInterval(favTick),favTick=null)'));
assert.ok(bundle.includes('etaCachePut(stop,r)'));
assert.ok(bundle.includes('favNextHtml(cached.rows,!0)'));
assert.ok(!bundle.includes('setInterval(()=>{Mt(e),pinSync(e)}'));

const start = bundle.indexOf('/* FAV_NEXT_BEGIN */');
const end = bundle.indexOf('/* FAV_NEXT_END */');
assert.ok(start >= 0 && end > start);
const mins = bundle.slice(bundle.indexOf('function xe('), bundle.indexOf('function we('));
const soon = bundle.slice(bundle.indexOf('function soonBus('), bundle.indexOf('async function armPing'));
const escapeStart = bundle.lastIndexOf('function U(e){return e.replaceAll');
const escape = bundle.slice(escapeStart, bundle.indexOf('function W(e){return`<span class="chip', escapeStart));
const api = new Function(`
  ${mins}
  ${soon}
  ${escape}
  ${bundle.slice(start, end)}
  return { favNextHtml };
`)();

assert.strictEqual(api.favNextHtml([]), '<span class="fav-next-miss">沒有</span>');
assert.strictEqual(
  api.favNextHtml([{ route: '1', etaMinutes: null, etaText: '暫時沒有班次' }]),
  '<span class="fav-next-miss">沒有</span>'
);

const next = api.favNextHtml([
  { route: '59X', etaMinutes: 12 },
  { route: '58X', etaMinutes: 4 }
]);
assert.ok(next.includes('fav-next-route">58X</span>'), next);
assert.ok(next.includes('eta-mins-num">4</span>'), next);
assert.ok(!next.includes('>12<'), next);
assert.ok(!next.includes('is-stale'), next);
assert.ok(!next.includes('is-word'), next);

const due = api.favNextHtml([{ route: '610', etaMinutes: 0 }]);
assert.ok(due.includes('fav-next-route">610</span>'), due);
assert.ok(due.includes('is-word'), due);
assert.ok(due.includes('即將'), due);
assert.ok(!due.includes('eta-mins-num'), due);

const stale = api.favNextHtml([{ route: '58X', etaMinutes: 4 }], true);
assert.ok(stale.includes('is-stale'), stale);
assert.ok(stale.includes('eta-mins-num">4</span>'), stale);

const hostile = api.favNextHtml([{ route: '1<2', etaMinutes: 3 }]);
assert.ok(hostile.includes('1&lt;2'), hostile);
assert.ok(!hostile.includes('1<2'), hostile);

for (const file of ['styles.css', `assets/index-${rev}.css`]) {
  const css = fs.readFileSync(path.join(root, file), 'utf8');
  const oldChevron = css.indexOf('.fav-block .fav-live-card .chevron{grid-area:1/2;align-self:center}');
  const nextCol = css.lastIndexOf('grid-area:1/3');
  const columns = css.lastIndexOf('grid-template-columns:minmax(0,1fr) 4rem auto');
  assert.ok(oldChevron > 0 && nextCol > oldChevron, file);
  assert.ok(columns > oldChevron, file);
  assert.ok(css.includes('.fav-next-mins.is-stale .eta-mins-num'), file);
  assert.ok(css.includes('.fav-next-mins.is-word'), file);
  assert.ok(css.includes('color:var(--streetlight-ink)'), file);
}

console.log('fav next ok');
