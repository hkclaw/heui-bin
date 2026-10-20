/* Recent search chips must ignore Chinese IME partials and composition junk. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');

assert.ok(bundle.includes('三樣一齊出'));
assert.ok(bundle.includes('最近搜尋'));
assert.ok(bundle.includes('$d(i,{saveRecent:i.trim().length>=2})'));
assert.ok(bundle.includes('window.__padCleared=!0,$d(``,{saveRecent:!1})'));
assert.ok(!bundle.includes('saveRecent:n.value.trim().length>=2'));
assert.ok(bundle.includes('compositionstart'));
assert.ok(bundle.includes('compositionend'));
assert.ok(bundle.includes('recentInputBlocked(n,e.isComposing)'));
assert.ok(bundle.includes('saveRecent:t?!n.__composing&&recentExact(e):recentShouldSave(e,!1)'));
assert.ok(bundle.includes('if(e&&!e.__composing){let t=e.value.trim();t.length>=2&&rt(t)}'));
assert.ok(bundle.includes('try{nt()}catch{}'));
assert.ok(bundle.includes('var padTimer'));
assert.ok(bundle.includes('window.clearTimeout(padTimer);padTimer=window.setTimeout(()=>{zt(e,t)},300)'));
assert.ok(!bundle.includes('clearTimeout($t)'));

const start = bundle.indexOf('/* RECENT_IME_BEGIN */');
const end = bundle.indexOf('/* RECENT_IME_END */');
assert.ok(start >= 0 && end > start);
const src = bundle.slice(start, end);

function b(e) {
  let t = String(e).replace(/巿/g, '市');
  let n = '';
  for (; n !== t;) n = t, t = t.replace(/\s*[（(][^）)]*[）)]\s*$/u, '');
  return t.replace(/(巴士)?總站$/u, '').replace(/\s+/g, '').trim();
}

function memoryStorage(seed) {
  const data = { ...seed };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
    dump() { return data; },
  };
}

function loadStops() {
  const files = [
    'kmb-stops.json', 'ctb-stops.json', 'nlb-stops.json', 'gmb-stops.json',
    'lrt-stations.json', 'mtr-stations.json', 'tml-stations.json',
  ];
  const stops = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8'));
    const arr = Array.isArray(data) ? data : (data.stops || []);
    for (const stop of arr) stops.push(stop);
  }
  return stops;
}

function harness(store, stops, ready) {
  const context = {
    localStorage: store,
    Je: 'tap-eta-recent-search-v1',
    N: 6,
    F: stops,
    re: () => ({ kmbReady: ready }),
    b,
  };
  vm.createContext(context);
  vm.runInContext(`${src}\nthis.api={recentPrune,nt,rt,recentShouldSave,recentExact,recentJunk,recentImeStart,recentImeEnd,recentInputBlocked};`, context);
  return context;
}

const stops = loadStops();
const key = 'tap-eta-recent-search-v1';

const dirty = memoryStorage({ [key]: JSON.stringify(['天水圍', '天水', '一大']) });
const early = harness(dirty, stops, false);
const plain = (value) => JSON.parse(JSON.stringify(value));
assert.deepStrictEqual(plain(early.api.nt()), ['天水圍', '一大']);
assert.deepStrictEqual(JSON.parse(dirty.getItem(key)), ['天水圍', '一大']);

const readyStore = memoryStorage({ [key]: JSON.stringify(['天水圍', '天水', '一大']) });
const ready = harness(readyStore, stops, true);
assert.strictEqual(ready.api.recentJunk('一大'), true);
assert.strictEqual(ready.api.recentJunk('大口'), false);
assert.strictEqual(ready.api.recentJunk('大水'), false);
assert.strictEqual(ready.api.recentJunk('天水'), false);
assert.strictEqual(ready.api.recentJunk('旺角'), false);
assert.strictEqual(ready.api.recentExact('天水圍'), true);
assert.strictEqual(ready.api.recentExact('天水'), false);
assert.strictEqual(ready.api.recentExact('一大'), false);
assert.strictEqual(ready.api.recentExact('269C'), true);
assert.deepStrictEqual(plain(ready.api.nt()), ['天水圍']);
assert.deepStrictEqual(JSON.parse(readyStore.getItem(key)), ['天水圍']);

assert.deepStrictEqual(plain(ready.api.rt('天')), ['天水圍']);
assert.deepStrictEqual(plain(ready.api.rt('269C')), ['269C', '天水圍']);
assert.deepStrictEqual(plain(ready.api.rt('一大')), ['269C', '天水圍']);
assert.deepStrictEqual(plain(ready.api.rt('大口')), ['大口', '269C', '天水圍']);
const keptRoutes = ready.api.recentPrune(['10', '1', '269C']);
assert.deepStrictEqual(plain(keptRoutes), ['10', '1', '269C']);

const field = {};
ready.api.recentImeStart(field);
assert.strictEqual(ready.api.recentInputBlocked(field, true), true);
assert.strictEqual(ready.api.recentShouldSave('天水', true), false);
ready.api.recentImeEnd(field);
assert.strictEqual(field.__composing, false);
assert.strictEqual(ready.api.recentInputBlocked(field, false), true);
assert.strictEqual(field.__imeCommit, false);
assert.strictEqual(ready.api.recentInputBlocked(field, false), false);
assert.strictEqual(ready.api.recentShouldSave('天水圍', false), true);
assert.strictEqual(ready.api.recentShouldSave('天', false), false);

const composing = { __composing: true };
assert.strictEqual(!composing.__composing && ready.api.recentExact('天水圍'), false);
const committed = { __composing: false };
assert.strictEqual(!committed.__composing && ready.api.recentExact('天水'), false);
assert.strictEqual(!committed.__composing && ready.api.recentExact('天水圍'), true);
assert.strictEqual(!committed.__composing && ready.api.recentExact('一大'), false);

console.log('recent search ime ok');
