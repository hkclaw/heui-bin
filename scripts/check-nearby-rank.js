/* Last-opened stops boost nearby ranking only while they are still close. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', `index-${rev}.css`), 'utf8');
const shell = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function sliceBetween(start, end) {
  const i = bundle.indexOf(start);
  const j = bundle.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, `missing ${start}`);
  return bundle.slice(i, j);
}

const rankSrc = sliceBetween('/* RANK_BEGIN */', '/* RANK_END */');
const emptySrc = sliceBetween('function recentEmpty()', 'function Vt(e){if(!e)return recentEmpty()');
assert.ok(bundle.includes('recentTouch(localStorage,n.type,n.id)'));
assert.ok(bundle.includes('return rankNearby(a,{limit:n,favorites:o,recents:s,pins:c})'));
assert.ok(bundle.includes('rankTier===1?`<span class="stop-recent">最近</span>`'));
assert.ok(bundle.includes('tap-eta-recent-stops-v1'));
assert.ok(css.includes('.stop-recent{'));
assert.ok(shell.includes('.stop-recent{'));

const api = new Function(`${rankSrc} return { recentLoad, recentTouch, rankNearby, rankKey, RECENT_STOPS_CAP, NEAR_BOOST_M, NEAR_SLACK_M, PIN_NUDGE_M };`)();
const { recentLoad, recentTouch, rankNearby, RECENT_STOPS_CAP, NEAR_BOOST_M, NEAR_SLACK_M, PIN_NUDGE_M } = api;

function memory(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

const ids = (rows) => rows.map((row) => row.id);

const empty = memory();
assert.deepStrictEqual(recentLoad(empty), []);
assert.deepStrictEqual(recentLoad(memory({ 'tap-eta-recent-stops-v1': '{' })), []);
assert.deepStrictEqual(recentLoad(memory({ 'tap-eta-recent-stops-v1': '{"no":1}' })), []);
assert.deepStrictEqual(recentTouch(null, '', ''), []);

const store = memory();
recentTouch(store, 'kmb', 'A', 1000);
recentTouch(store, 'ctb', 'B', 2000);
recentTouch(store, 'tml', 'WKS', 3000);
recentTouch(store, 'mtr', 'WKS', 4000);
recentTouch(store, 'lrt', '1', 500);
recentTouch(store, 'nope', 'Z', 9000);
let loaded = recentLoad(store);
assert.deepStrictEqual(loaded.map((row) => `${row.type}:${row.id}`), ['mtr:WKS', 'ctb:B', 'kmb:A', 'lrt:1']);
assert.strictEqual(loaded[0].at, 4000);
assert.strictEqual(loaded.filter((row) => row.id === 'WKS').length, 1);

const capped = memory();
for (let i = 0; i < RECENT_STOPS_CAP + 4; i++) recentTouch(capped, 'kmb', `S${i}`, i + 1);
loaded = recentLoad(capped);
assert.strictEqual(loaded.length, RECENT_STOPS_CAP);
assert.strictEqual(loaded[0].id, `S${RECENT_STOPS_CAP + 3}`);
assert.ok(!loaded.some((row) => row.id === 'S0'));
recentTouch(capped, 'kmb', loaded[RECENT_STOPS_CAP - 1].id, 99999);
loaded = recentLoad(capped);
assert.strictEqual(loaded[0].id, `S4`);
assert.strictEqual(loaded.length, RECENT_STOPS_CAP);

const throwing = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
};
assert.deepStrictEqual(recentLoad(throwing), []);
assert.deepStrictEqual(recentTouch(throwing, 'kmb', 'A', 1).map((row) => row.id), ['A']);

function stop(id, distanceM, type = 'kmb') {
  return { type, id, name_tc: id, distanceM };
}

const cluster = [10, 20, 30, 40, 50].map((distanceM, index) => stop(`N${index}`, distanceM));
const far = stop('FAR', 5000);
const plain = rankNearby([...cluster, far], { limit: 5 });
assert.deepStrictEqual(ids(plain), ['N0', 'N1', 'N2', 'N3', 'N4']);
assert.ok(plain.every((row) => row.rankTier === 2));

const nearRecent = rankNearby([...cluster, stop('RECENT', 200)], {
  limit: 5,
  recents: [{ type: 'kmb', id: 'RECENT', at: 50 }, { type: 'kmb', id: 'FAR', at: 80 }],
});
assert.deepStrictEqual(ids(nearRecent), ['RECENT', 'N0', 'N1', 'N2', 'N3']);
assert.strictEqual(nearRecent[0].rankTier, 1);
assert.ok(!ids(nearRecent).includes('FAR'));

const outsideSlack = rankNearby([...cluster, stop('RECENT', 50 + NEAR_SLACK_M + 1)], {
  limit: 5,
  recents: [{ type: 'kmb', id: 'RECENT', at: 50 }],
});
assert.deepStrictEqual(ids(outsideSlack), ['N0', 'N1', 'N2', 'N3', 'N4']);

const wide = [600, 640, 680, 720, 760].map((distanceM, index) => stop(`W${index}`, distanceM));
const atCap = rankNearby([...wide, stop('RECENT', NEAR_BOOST_M, 'mtr')], {
  limit: 5,
  recents: [{ type: 'tml', id: 'RECENT', at: 9 }],
});
assert.strictEqual(atCap[0].id, 'RECENT');
assert.strictEqual(atCap[0].rankTier, 1);

const beyondCap = rankNearby([...wide, stop('RECENT', NEAR_BOOST_M + 1)], {
  limit: 5,
  recents: [{ type: 'kmb', id: 'RECENT', at: 9 }],
});
assert.deepStrictEqual(ids(beyondCap), ['W0', 'W1', 'W2', 'W3', 'W4']);

const favAndRecent = rankNearby(
  [...cluster, stop('FAV', 180), stop('RECENT', 100)],
  {
    limit: 5,
    favorites: [{ type: 'kmb', id: 'FAV' }],
    recents: [
      { type: 'kmb', id: 'RECENT', at: 20 },
      { type: 'kmb', id: 'FAV', at: 10 },
    ],
  },
);
assert.deepStrictEqual(ids(favAndRecent), ['FAV', 'RECENT', 'N0', 'N1', 'N2']);
assert.strictEqual(favAndRecent[0].rankTier, 0);
assert.strictEqual(favAndRecent[1].rankTier, 1);

const farFavorite = rankNearby([...cluster, stop('FAV', 900)], {
  limit: 5,
  favorites: [{ type: 'kmb', id: 'FAV' }],
});
assert.deepStrictEqual(ids(farFavorite), ['N0', 'N1', 'N2', 'N3', 'N4']);

const favoriteAlreadyIn = rankNearby(
  [stop('PLAIN', 10), stop('FAV', 40), stop('OTHER', 20)],
  { limit: 3, favorites: [{ type: 'kmb', id: 'FAV' }] },
);
assert.deepStrictEqual(ids(favoriteAlreadyIn), ['FAV', 'PLAIN', 'OTHER']);

const newestFirst = rankNearby(
  [stop('OLD', 120), stop('NEW', 220), stop('N0', 10), stop('N1', 20), stop('N2', 30)],
  {
    limit: 5,
    recents: [
      { type: 'kmb', id: 'OLD', at: 1 },
      { type: 'kmb', id: 'NEW', at: 2 },
    ],
  },
);
assert.deepStrictEqual(ids(newestFirst).slice(0, 2), ['NEW', 'OLD']);

const pinnedFar = rankNearby([...cluster, stop('PIN', 400)], {
  limit: 5,
  pins: [{ type: 'kmb', id: 'PIN', route: '1' }],
});
assert.deepStrictEqual(ids(pinnedFar), ['N0', 'N1', 'N2', 'N3', 'N4']);

const pinnedNudge = rankNearby(
  [stop('A', 10), stop('B', 100), stop('PIN', 120)],
  { limit: 3, pins: [{ type: 'kmb', id: 'PIN' }] },
);
assert.deepStrictEqual(ids(pinnedNudge), ['A', 'PIN', 'B']);

const pinnedGap = rankNearby(
  [stop('A', 10), stop('B', 100), stop('PIN', 100 + PIN_NUDGE_M + 1)],
  { limit: 3, pins: [{ type: 'kmb', id: 'PIN' }] },
);
assert.deepStrictEqual(ids(pinnedGap), ['A', 'B', 'PIN']);

const pinnedStopsBeforeRecent = rankNearby(
  [stop('NEAR', 10), stop('PIN', 40), stop('RECENT', 200)],
  {
    limit: 3,
    recents: [{ type: 'kmb', id: 'RECENT', at: 5 }],
    pins: [{ type: 'kmb', id: 'PIN' }],
  },
);
assert.deepStrictEqual(ids(pinnedStopsBeforeRecent), ['RECENT', 'PIN', 'NEAR']);

const tied = [stop('m2', 100, 'mtr'), stop('k1', 100, 'kmb')];
assert.deepStrictEqual(ids(rankNearby(tied, { limit: 2 })), ['k1', 'm2']);
assert.deepStrictEqual(ids(rankNearby(tied.slice().reverse(), { limit: 2 })), ['k1', 'm2']);

const stops = [
  { type: 'kmb', id: 'A', name_tc: '甲', name_en: 'A' },
  { type: 'ctb', id: 'B', name_tc: '乙', name_en: 'B' },
  { type: 'lrt', id: 'C', name_tc: '丙', name_en: 'C' },
  { type: 'mtr', id: 'WKS', name_tc: '烏溪沙', name_en: 'Wu Kai Sha' },
];
function modeHit(type, mode) {
  return mode == null || (mode === 'bus' ? type === 'kmb' || type === 'ctb' : type === mode);
}
const history = memory();
recentTouch(history, 'lrt', 'C', 1);
recentTouch(history, 'kmb', 'A', 2);
recentTouch(history, 'tml', 'WKS', 3);
const emptyHtml = new Function(
  'recentLoad', 'localStorage', 'Xe', 'E', 'F', 'V', 'modeHit', 'Qe', 'W', 'U', 'Pt', 'Kt', 'G', 'rankKey',
  `${emptySrc} return recentEmpty();`,
)(
  recentLoad,
  history,
  () => [{ type: 'kmb', id: 'A' }],
  (list, type, id) => list.find((row) => row.type === type && row.id === id) || null,
  stops,
  null,
  modeHit,
  (row) => row.id === 'A',
  (type) => type,
  (value) => value,
  () => '',
  () => '',
  (row) => `${row.type}:${row.id}`,
  api.rankKey,
);
assert.ok(emptyHtml.includes('最近去過'));
assert.ok(emptyHtml.indexOf('data-nav="/eta/kmb/A"') < emptyHtml.indexOf('data-nav="/eta/mtr/WKS"'));
assert.ok(emptyHtml.indexOf('data-nav="/eta/mtr/WKS"') < emptyHtml.indexOf('data-nav="/eta/lrt/C"'));
assert.ok(emptyHtml.includes('烏溪沙'));
assert.ok(emptyHtml.includes('star-btn on'));

const busOnly = new Function(
  'recentLoad', 'localStorage', 'Xe', 'E', 'F', 'V', 'modeHit', 'Qe', 'W', 'U', 'Pt', 'Kt', 'G', 'rankKey',
  `${emptySrc} return recentEmpty();`,
)(
  recentLoad,
  history,
  () => [],
  (list, type, id) => list.find((row) => row.type === type && row.id === id) || null,
  stops,
  'bus',
  modeHit,
  () => false,
  (type) => type,
  (value) => value,
  () => '',
  () => '',
  (row) => `${row.type}:${row.id}`,
  api.rankKey,
);
assert.ok(busOnly.includes('data-nav="/eta/kmb/A"'));
assert.ok(!busOnly.includes('data-nav="/eta/lrt/C"'));
assert.ok(!busOnly.includes('data-nav="/eta/mtr/WKS"'));

const noHistory = new Function(
  'recentLoad', 'localStorage', 'Xe', 'E', 'F', 'V', 'modeHit', 'Qe', 'W', 'U', 'Pt', 'Kt', 'G', 'rankKey',
  `${emptySrc} return recentEmpty();`,
)(
  recentLoad,
  memory(),
  () => [],
  () => null,
  stops,
  null,
  modeHit,
  () => false,
  () => '',
  (value) => value,
  () => '',
  () => '',
  () => '',
  api.rankKey,
);
assert.ok(noHistory.includes('輸入站名'));
assert.ok(!noHistory.includes('最近去過'));

console.log('nearby rank ok');
