/* Locks the 巴士 filter as a UI union of KMB/LWB, Citybus, New Lantao Bus, and green minibuses. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');

assert.ok(bundle.includes('Ye=[{type:`lrt`,label:`輕鐵`},{type:`mtr`,label:`港鐵`},{type:`bus`,label:`巴士`}]'));
assert.ok(!bundle.includes('label:`九巴`'));
assert.ok(!bundle.includes('label:`城巴`'));
assert.ok(bundle.includes('kmb:`九巴／龍運`,ctb:`城巴`'));
assert.ok(bundle.includes('t===`kmb`||t===`ctb`||t===`nlb`||t===`gmb`||t===`lrt`||t===`tml`||t===`mtr`'));
assert.ok(bundle.includes('function modeHit(e,t){return t==null||(t===`bus`?e===`kmb`||e===`ctb`||e===`nlb`||e===`gmb`:e===t)}'));
assert.ok(!bundle.includes('label:`專線小巴`'));
assert.ok(bundle.includes('ue(e).filter(e=>modeHit(e.type,r))'));
assert.ok(bundle.includes('if(modeHit(t.type,r))for(let e of t.routes??[])'));
assert.ok(bundle.includes('ue(e).filter(e=>modeHit(e.type,n)&&(e.routes??[]).some(e=>e.toUpperCase()===r))'));
assert.ok(bundle.includes('&&Me(e)&&modeHit(e.type,r)'));

function sliceBetween(start, end) {
  const i = bundle.indexOf(start);
  const j = bundle.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, `missing ${start}`);
  return bundle.slice(i, j);
}

const modeSrc = sliceBetween('function modeHit(e,t)', 'function C(e,t,n=80,r=null)');
const searchSrc = sliceBetween('function C(e,t,n=80,r=null)', 'function E(e,t,n){let r=e.find');
const nearbySrc = sliceBetween('function Pe(e,t,n=5,r=null)', 'function Fe(');
const rankSrc = sliceBetween('/* RANK_BEGIN */', '/* RANK_END */');
const etSrc = sliceBetween('function et(){', 'function tt(');
const ttSrc = sliceBetween('function tt(e){', 'function M(');
const mSrc = sliceBetween('function M(e){let t=et()===e?null:e;return tt(t),t}', 'var N=6');
const yeSrc = sliceBetween('Ye=[{type:`lrt`', '];') + '];';
const wtSrc = sliceBetween('function wt(){', 'function Tt(');

const { modeHit, C, w, T } = new Function(
  `${modeSrc}${searchSrc} function ue(e){return e} return { modeHit, C, w, T };`
)();
const { Pe } = new Function(
  `${rankSrc}${modeSrc}${nearbySrc}
   function ue(e){return e}
   function Me(){return true}
   function Ne(o,s){return Math.hypot(o.lat-s.lat,o.lng-s.lng)}
   return { Pe };`
)();

const stops = [
  { type: 'kmb', id: 'k1', name_tc: '九巴站', name_en: 'KMB Stop', routes: ['1', '269C'], lat: 22.3, lng: 114.1 },
  { type: 'ctb', id: 'c1', name_tc: '城巴站', name_en: 'CTB Stop', routes: ['1', '720'], lat: 22.31, lng: 114.11 },
  { type: 'nlb', id: 'n1', name_tc: '嶼巴站', name_en: 'NLB Stop', routes: ['B2', 'A35'], lat: 22.32, lng: 114.12 },
  { type: 'gmb', id: '20003337', name_tc: '小巴站', name_en: 'GMB Stop', routes: ['69'], lat: 22.305, lng: 114.105 },
  { type: 'lrt', id: 'l1', name_tc: '輕鐵站', name_en: 'LRT Stop', routes: ['610'], lat: 22.4, lng: 114.2 },
  { type: 'mtr', id: 'm1', name_tc: '港鐵站', name_en: 'MTR Stop', routes: ['TML'], lat: 22.5, lng: 114.3 },
];
const types = (rows) => rows.map((row) => row.type).sort();

assert.deepStrictEqual(types(C(stops, '站', 80, 'bus')), ['ctb', 'gmb', 'kmb', 'nlb']);
assert.deepStrictEqual(types(C(stops, '站', 80, null)), ['ctb', 'gmb', 'kmb', 'lrt', 'mtr', 'nlb']);
assert.deepStrictEqual(types(C(stops, '站', 80, 'lrt')), ['lrt']);
assert.deepStrictEqual(types(C(stops, '九巴', 80, 'bus')), ['kmb']);
assert.deepStrictEqual(types(C(stops, '小巴', 80, 'bus')), ['gmb']);
assert.deepStrictEqual(types(C(stops, '小巴', 80, 'lrt')), []);
assert.deepStrictEqual(w(stops, '1', 24, 'bus').map((row) => row.route), ['1']);
assert.deepStrictEqual(w(stops, '720', 24, 'bus').map((row) => row.route), ['720']);
assert.deepStrictEqual(w(stops, 'B2', 24, 'bus').map((row) => row.route), ['B2']);
assert.deepStrictEqual(w(stops, 'A35', 24, 'bus').map((row) => row.route), ['A35']);
assert.deepStrictEqual(w(stops, '720', 24, 'lrt'), []);
assert.deepStrictEqual(w(stops, 'A35', 24, 'lrt'), []);
assert.deepStrictEqual(w(stops, '610', 24, 'bus'), []);
assert.deepStrictEqual(w(stops, '269C', 24, null).map((row) => row.route), ['269C']);
assert.deepStrictEqual(types(T(stops, '1', 'bus')), ['ctb', 'kmb']);
assert.deepStrictEqual(types(T(stops, '1', null)), ['ctb', 'kmb']);
assert.deepStrictEqual(types(T(stops, '720', 'bus')), ['ctb']);
assert.deepStrictEqual(types(T(stops, 'B2', 'bus')), ['nlb']);
assert.deepStrictEqual(types(T(stops, 'A35', 'bus')), ['nlb']);
assert.deepStrictEqual(w(stops, '69', 24, 'bus').map((row) => row.route), ['69']);
assert.deepStrictEqual(w(stops, '69', 24, 'lrt'), []);
assert.deepStrictEqual(types(T(stops, '69', 'bus')), ['gmb']);
assert.deepStrictEqual(types(T(stops, '69', 'lrt')), []);
assert.deepStrictEqual(types(T(stops, '610', 'bus')), []);
assert.deepStrictEqual(types(T(stops, '269C', 'lrt')), []);
assert.strictEqual(modeHit('kmb', 'bus'), true);
assert.strictEqual(modeHit('ctb', 'bus'), true);
assert.strictEqual(modeHit('nlb', 'bus'), true);
assert.strictEqual(modeHit('gmb', 'bus'), true);
assert.strictEqual(modeHit('gmb', 'lrt'), false);
assert.strictEqual(modeHit('gmb', null), true);
assert.strictEqual(modeHit('nlb', 'lrt'), false);
assert.strictEqual(modeHit('lrt', 'bus'), false);
assert.strictEqual(modeHit('mtr', null), true);
assert.strictEqual(modeHit('kmb', 'kmb'), true);

const nearBus = Pe(stops, { lat: 22.3, lng: 114.1 }, 5, 'bus');
assert.deepStrictEqual(nearBus.map((row) => row.type), ['kmb', 'gmb', 'ctb', 'nlb']);
assert.deepStrictEqual(Pe(stops, { lat: 22.3, lng: 114.1 }, 5, 'lrt').map((row) => row.id), ['l1']);
assert.strictEqual(Pe(stops, { lat: 22.3, lng: 114.1 }, 8, null).length, 6);

function memory() {
  const store = new Map();
  return {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}
function filterApi(localStorage) {
  return new Function(
    'localStorage',
    `var Ke='tap-eta-mode-filter-v1'; ${etSrc}${ttSrc}${mSrc} return { et, M };`
  )(localStorage);
}

const migrated = memory();
migrated.setItem('tap-eta-mode-filter-v1', 'kmb');
let api = filterApi(migrated);
assert.strictEqual(api.et(), 'bus');
assert.strictEqual(migrated.getItem('tap-eta-mode-filter-v1'), 'bus');
migrated.setItem('tap-eta-mode-filter-v1', 'ctb');
assert.strictEqual(api.et(), 'bus');
assert.strictEqual(migrated.getItem('tap-eta-mode-filter-v1'), 'bus');

const kept = memory();
kept.setItem('tap-eta-mode-filter-v1', 'lrt');
api = filterApi(kept);
assert.strictEqual(api.et(), 'lrt');
assert.strictEqual(kept.getItem('tap-eta-mode-filter-v1'), 'lrt');
kept.setItem('tap-eta-mode-filter-v1', 'mtr');
assert.strictEqual(api.et(), 'mtr');
kept.setItem('tap-eta-mode-filter-v1', 'tml');
assert.strictEqual(api.et(), 'mtr');
assert.strictEqual(kept.getItem('tap-eta-mode-filter-v1'), 'tml');
kept.setItem('tap-eta-mode-filter-v1', 'bus');
assert.strictEqual(api.et(), 'bus');
kept.setItem('tap-eta-mode-filter-v1', 'nope');
assert.strictEqual(api.et(), null);
assert.strictEqual(api.M('bus'), 'bus');
assert.strictEqual(kept.getItem('tap-eta-mode-filter-v1'), 'bus');
assert.strictEqual(api.M('bus'), null);
assert.strictEqual(kept.getItem('tap-eta-mode-filter-v1'), null);

const chips = new Function(
  'V',
  `var Ye; ${yeSrc} ${wtSrc} return wt();`
)('bus');
assert.ok(chips.includes('>巴士</button>'));
assert.ok(chips.includes('>輕鐵</button>'));
assert.ok(chips.includes('>港鐵</button>'));
assert.ok(!chips.includes('九巴'));
assert.ok(!chips.includes('城巴'));
assert.ok(!chips.includes('專線小巴'));
assert.ok(chips.includes('data-mode-chip="bus"'));
assert.ok(chips.includes('data-mode-chip="lrt"'));
assert.ok(chips.includes('data-mode-chip="mtr"'));
assert.ok(!chips.includes('data-mode-chip="kmb"'));
assert.ok(!chips.includes('data-mode-chip="ctb"'));
assert.strictEqual(chips.match(/data-mode-chip="/g).length, 3);
assert.ok(chips.includes('mode-chip-bus on'));
assert.ok(chips.includes('aria-pressed="true"'));

const off = new Function('V', `var Ye; ${yeSrc} ${wtSrc} return wt();`)(null);
assert.strictEqual(off.match(/aria-pressed="true"/g), null);

console.log('bus filter ok');
