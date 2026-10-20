/* Calm hierarchy sits on top of the offline ETA skin.
   Ghost rows, the stale amber, and the offline bar stay in force. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');

for (const file of ['styles.css', `assets/index-${rev}.css`]) {
  const css = fs.readFileSync(path.join(root, file), 'utf8');
  const calm = css.indexOf('/* calm-hierarchy:');
  assert.ok(calm > 0, file);
  const tail = css.slice(calm);
  assert.ok(tail.includes('.nearby-block>.section-label'), file);
  assert.ok(tail.includes('.fav-block .section-label'), file);
  assert.ok(tail.includes('.mode-chip{min-height:44px;box-shadow:none}'), file);
  assert.ok(tail.includes('.topbar .btn.top-search'), file);
  assert.ok(tail.includes('min-height:44px'), file);
  assert.ok(tail.includes('.eta-list:not(.eta-skel)>'), file);
  assert.ok(tail.includes(':not(.eta-skel-row)'), file);
  assert.ok(tail.includes('@media (prefers-reduced-motion:reduce)'), file);
  const stale = tail.lastIndexOf('.eta-body.is-stale .eta-mins-num');
  const hero = tail.indexOf('font-size:2.15rem');
  assert.ok(hero > 0 && stale > hero, file + ' stale color must follow the hero size');
  const skel = tail.lastIndexOf('.eta-skel-row .eta-time{color:transparent');
  assert.ok(skel > hero, file + ' skeleton ink must follow the hero size');
  assert.ok(css.includes('.eta-stale-banner'), file);
  assert.ok(css.includes('.offline-banner'), file);
  assert.ok(css.includes('html.is-offline .topbar'), file);
  assert.ok(css.includes('prefers-reduced-motion:no-preference'), file);
  assert.ok(css.includes('.app-shell .eta-tools .btn[data-action="refresh-eta"]'), file);
  assert.ok(tail.includes('border:1px solid var(--line)'), file);
}

const favCard = bundle.slice(bundle.lastIndexOf('function Ft(e){return`'), bundle.indexOf('function padApply'));
assert.ok(!favCard.includes('fav-eta'));
assert.ok(bundle.includes('etaSkeletonHtml'));
assert.ok(bundle.includes('className=`eta-stale-banner`'));

console.log('calm hierarchy ok');
