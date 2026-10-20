/* Home keeps its height while catalogues and nearby stops load. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', `index-${rev}.css`), 'utf8');
const shell = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

const pending = bundle.slice(bundle.indexOf('St===`idle`||St===`pending`'), bundle.indexOf('St===`denied`||St===`unavailable`'));
assert.ok(pending.includes('nearby-map nearby-map-sm nearby-map-placeholder'));
assert.ok(pending.includes('nearby-skel'));
assert.ok(pending.includes('nearby-skel-card'));
assert.ok(pending.includes('.repeat(5)'));
assert.ok(!pending.includes('nearby-actions'));

assert.ok(bundle.includes('loc=St===`idle`||St===`pending`'));
assert.ok(bundle.includes('else if(!loc)n.style.minHeight=``'));
assert.ok(bundle.includes('n.classList.toggle(`is-noloc`,!r&&!loc)'));

for (const sheet of [css, shell]) {
  assert.ok(sheet.includes('#nearby-slot .stop-card{animation:none}'));
  assert.ok(sheet.includes('#nearby-slot .nearby-map-sm{max-height:180px}'));
  assert.ok(sheet.includes('.fav-live-card .fav-eta{min-height:5.8rem}'));
  const favReserve = sheet.indexOf('.fav-live-card .fav-eta{min-height:5.8rem}');
  const favDense = sheet.indexOf('.fav-live-card .fav-eta{min-height:4.7rem}');
  assert.ok(favDense > favReserve);
  assert.ok(sheet.includes('.fav-live-card{row-gap:4px;column-gap:8px;padding:8px 12px}'));
  assert.ok(sheet.includes('.fav-eta-preview{gap:2px}'));
  assert.ok(sheet.includes('#kmb-hint:not(:empty){position:fixed;'));
  assert.ok(!sheet.includes('#nearby-slot:has(.nearby-pending)'));
  assert.ok(sheet.includes('#nearby-slot:has(.nearby-noloc)'));
  assert.ok(sheet.includes('html.show-install-entry .app-shell:has(#nearby-slot) .main{padding-top:60px}'));
  assert.ok(sheet.includes('html.show-install-entry .arrive-install-row{position:absolute;'));
  assert.ok(sheet.includes('button{-webkit-appearance:none;appearance:none}'));
  assert.ok(sheet.includes('.nearby-map.nearby-map-placeholder{overflow:visible}'));
  assert.ok(sheet.includes('.app-shell .eta-tools{-webkit-backdrop-filter:none;backdrop-filter:none;background:#0e1418}'));
  assert.ok(sheet.includes('.stop-card{animation-fill-mode:none}'));
}

const favCard = bundle.slice(bundle.lastIndexOf('function Ft(e){return`'), bundle.indexOf('function padApply'));
assert.ok(favCard.includes('stop-name'));
assert.ok(favCard.includes('${W(e.type)}'));
assert.ok(favCard.includes('${Pt(e)}'));
assert.ok(favCard.includes('data-nav='));
assert.ok(!favCard.includes('fav-eta'));
assert.ok(!favCard.includes('載入班次'));
assert.ok(bundle.includes('data-pin-eta'));
assert.ok(bundle.includes('setInterval(()=>pinSync(e)'));
assert.ok(!bundle.includes('setInterval(()=>{Mt(e),pinSync(e)}'));
for (const sheet of [css, shell]) {
  assert.ok(sheet.includes('.fav-block .fav-live-card{grid-template-rows:auto;align-items:center}'));
  assert.ok(sheet.includes('.fav-block .fav-live-card .chevron{grid-area:1/2;align-self:center}'));
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.includes("document.documentElement.classList.add('show-install-entry')"));
const arrive = fs.readFileSync(path.join(root, 'assets', 'arrive-notify.js'), 'utf8');
assert.ok(arrive.includes("classList.toggle('show-install-entry', !row.hidden)"));

console.log('home layout ok');
