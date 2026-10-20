/* Last-known ETAs stay visible only with an honest age.
   A payload without a timestamp must not be shown as current. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const start = bundle.indexOf('/* ETA_CACHE_BEGIN */');
const end = bundle.indexOf('/* ETA_CACHE_END */');
assert.ok(start >= 0 && end > start, 'ETA cache helpers missing');
const src = bundle.slice(start, end);

function memoryStorage(seed) {
  const data = { ...seed };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
    dump() { return data; },
  };
}

function load(store, now) {
  const clock = { now: () => now.value };
  const context = {
    localStorage: store,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    Error,
    Date: clock,
  };
  vm.createContext(context);
  vm.runInContext(`${src}\nthis.api={etaAgeLabel,etaCachePut,etaCacheGet,etaDecide,etaSnapshot,etaCacheKey,ETA_CACHE_KEY,ETA_CACHE_KEEP_MS};`, context);
  return context.api;
}

const stop = { type: 'kmb', id: 'A3ADFCDF8487CE36' };
const rows = [{ route: '98C', dest: '美孚', etaText: '3 分鐘', etaMinutes: 3, key: 'k' }];
const now = { value: 1_700_000_000_000 };
const api = load(memoryStorage({}), now);

assert.strictEqual(api.etaAgeLabel(now.value - 30_000), '約 30 秒前');
assert.strictEqual(api.etaAgeLabel(now.value - 120_000), '約 2 分鐘前');
assert.strictEqual(api.etaAgeLabel(now.value - 3_600_000), '約 1 小時前');
assert.strictEqual(api.etaAgeLabel(now.value + 5_000), '');
assert.strictEqual(api.etaAgeLabel(undefined), '');
assert.strictEqual(api.etaAgeLabel(null), '');

const saved = api.etaCachePut(stop, rows);
assert.ok(saved && saved.at === now.value);
assert.strictEqual(saved.rows[0].route, '98C');
assert.strictEqual(saved.rows[0].etaMinutes, 3);

now.value += 30_000;
const hit = api.etaCacheGet(stop);
assert.strictEqual(hit.at, saved.at);
assert.strictEqual(api.etaAgeLabel(hit.at), '約 30 秒前');

const live = api.etaDecide(true, rows, hit, null);
assert.strictEqual(live.kind, 'live');
assert.strictEqual(live.at, now.value);

const stale = api.etaDecide(false, null, hit, null);
assert.strictEqual(stale.kind, 'stale');
assert.strictEqual(stale.at, saved.at);
assert.strictEqual(stale.rows[0].etaText, '3 分鐘');

const shown = api.etaDecide(false, null, null, { at: now.value - 120_000, rows });
assert.strictEqual(shown.kind, 'stale');
assert.strictEqual(api.etaAgeLabel(shown.at), '約 2 分鐘前');

const undated = api.etaDecide(false, null, { rows }, { rows });
assert.strictEqual(undated.kind, 'error');
assert.strictEqual(undated.rows.length, 0);
assert.strictEqual(undated.at, null);

const seeded = memoryStorage({
  'tap-eta-stop-cache-v1': JSON.stringify({
    'kmb|A3ADFCDF8487CE36': { rows },
    'mtr|ADM': { at: 'yesterday', rows },
  }),
});
const cold = load(seeded, now);
assert.strictEqual(cold.etaCacheGet(stop), null);
assert.strictEqual(cold.etaCacheGet({ type: 'mtr', id: 'ADM' }), null);
assert.strictEqual(cold.etaDecide(false, null, cold.etaCacheGet(stop), null).kind, 'error');

now.value = saved.at + cold.ETA_CACHE_KEEP_MS + 1;
assert.strictEqual(api.etaCacheGet(stop), null);
assert.strictEqual(api.etaDecide(false, null, hit, null).kind, 'error');

const empty = load(memoryStorage({}), { value: 50_000 });
const none = empty.etaCachePut(stop, []);
assert.ok(none && none.rows.length === 0);
assert.strictEqual(empty.etaCacheGet(stop).rows.length, 0);
assert.strictEqual(empty.etaDecide(false, null, empty.etaCacheGet(stop), null).kind, 'stale');

assert.ok(bundle.includes('eta-skel'));
assert.ok(bundle.includes('載入到站時間…'));
assert.ok(bundle.includes('上次記錄 · '));
assert.ok(bundle.includes('而家冇網絡。收藏同最近搜尋仍然可用。'));
assert.ok(bundle.includes('而家冇網絡，未有呢個站嘅記錄'));
assert.ok(bundle.includes('暫時連唔到，未有可顯示嘅記錄'));
assert.ok(bundle.includes('offlineBannerSync()'));
assert.ok(bundle.includes('etaShownAt=0,etaShownLive=!1'));
assert.ok(bundle.includes('n.textContent=`更新於 ${O(Date.now(),!0)}`'));
assert.ok(!bundle.includes('t.textContent=`更新於 ${O(Date.now(),!0)}`'), 'the old unguarded live stamp must be gone');

const favCard = bundle.slice(bundle.lastIndexOf('function Ft(e){return`'), bundle.indexOf('function padApply'));
assert.ok(!favCard.includes('fav-eta'));
assert.ok(!favCard.includes('載入班次'));
assert.ok(bundle.includes('function recentLoad'));
assert.ok(bundle.includes('tap-eta-recent-stops-v1') || bundle.includes('RECENT_STOPS_KEY'));

assert.ok(sw.includes('"navigate"===e.mode,new e.NetworkOnly'));
assert.ok(sw.includes('e.pathname==="/rev.txt"'));
assert.ok(sw.includes('heui-bin-catalogues-'));
assert.ok(sw.includes('/data\\/.*\\.json$/i,new e.NetworkFirst'));
assert.ok(sw.includes('data\\.etabus\\.gov\\.hk\\/.*/i,new e.NetworkOnly'));
assert.ok(sw.includes('rt\\.data\\.gov\\.hk\\/.*/i,new e.NetworkOnly'));
assert.ok(sw.includes('etagmb\\.gov\\.hk\\/.*/i,new e.NetworkOnly'));
assert.ok(!sw.includes('heui-bin-kmb-eta-'));
assert.ok(!sw.includes('heui-bin-mtr-eta-'));
assert.ok(!sw.includes('heui-bin-gmb-eta-'));
assert.ok(html.includes(`var REV = '${rev}'`));
assert.ok(html.includes('function heuiCheckUpdate()'));
assert.ok(html.includes("fetch('/rev.txt'"));

for (const file of ['styles.css', `assets/index-${rev}.css`]) {
  const css = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(css.includes('.eta-skel-row'), file);
  assert.ok(css.includes('.eta-stale-banner'), file);
  assert.ok(css.includes('.offline-banner'), file);
  assert.ok(css.includes('html.is-offline .topbar'), file);
  assert.ok(css.includes('prefers-reduced-motion:no-preference'), file);
}

console.log('offline eta ok');
