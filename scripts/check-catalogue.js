/* Locks the station coordinates, Tuen Ma entrances, and the KMB route list
   that nearby ranking and Maps actually use. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const mtr = JSON.parse(fs.readFileSync(path.join(root, 'data', 'mtr-stations.json'), 'utf8'));
const tml = JSON.parse(fs.readFileSync(path.join(root, 'data', 'tml-stations.json'), 'utf8'));
const kmb = JSON.parse(fs.readFileSync(path.join(root, 'data', 'kmb-stops.json'), 'utf8'));

function hav(a, b) {
  const rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function at(id) {
  const stop = mtr.find((stop) => stop.id === id);
  assert.ok(stop, id);
  return stop;
}

const hok = at('HOK');
const kow = at('KOW');
const sht = at('SHT');
const tsw = at('TSW');
const rac = at('RAC');
assert.ok(hav(hok, at('CEN')) < 1000, 'Hong Kong station sits with Central');
assert.ok(hav(hok, at('TSY')) > 5000, 'Hong Kong station is not the Tsing Yi point');
assert.ok(hav(kow, at('AUS')) < 1000, 'Kowloon station sits with Austin');
assert.ok(hav(kow, at('KOT')) > 2000, 'Kowloon station is not Kowloon Tong');
assert.ok(hav(sht, at('STW')) > 500, 'Sha Tin is not Sha Tin Wai');
assert.ok(hav(sht, at('FOT')) < 3000);
assert.ok(hav(tsw, at('TWW')) > 400, 'Tsuen Wan is not Tsuen Wan West');
assert.ok(hav(tsw, at('TWH')) < 1500);
assert.deepStrictEqual(rac.lines, ['EAL']);
assert.strictEqual(rac.name_tc, '馬場');
assert.ok(hav(rac, at('FOT')) < 2000);
assert.ok(!hok.exits && !kow.exits && !sht.exits && !tsw.exits);

const tmlIds = new Set(tml.map((stop) => stop.id));
for (const stop of mtr) {
  if (!tmlIds.has(stop.id)) continue;
  assert.ok(stop.exits && stop.exits.length, `${stop.id} keeps its Tuen Ma entrances`);
}
assert.ok(at('MEF').exits.length >= 4);
assert.ok(at('ETS').exits.length >= 4);

const routes = new Set();
for (const stop of kmb) {
  assert.strictEqual(stop.type, 'kmb');
  assert.ok(Array.isArray(stop.routes) && stop.routes.length);
  for (const route of stop.routes) routes.add(route);
}
for (const route of ['11A', '17A', '75F', '76A', '253', '307D', '600X', 'B10', 'B11', 'N64P', 'N272', 'NB73']) {
  assert.ok(routes.has(route), route);
}
for (const route of ['63R', '907D', 'HK2', 'N73', 'N276', 'SP12']) {
  assert.ok(!routes.has(route), route);
}

assert.ok(bundle.includes('case`lrt`:return t.length===1?me(t[0])'));
assert.ok(bundle.includes('e.type===`lrt`)&&e.memberIds'));
assert.ok(bundle.includes('if(!R||!re().kmbReady)'));
assert.ok(bundle.includes('t?.hidePlat||!e.platform?'));
assert.ok(!bundle.includes('屯馬線'));
assert.ok(bundle.includes('e.rows.slice(0,4)'));
assert.ok(bundle.includes('仲有 ${r} 班'));
assert.ok(bundle.includes('exits.set(e.id,e.exits)'));
assert.ok(bundle.includes('data-nav="${U(etaPath(type,e.id,t))}"'));
assert.ok(bundle.includes('class="stop-card-hit"'));

console.log(`catalogue ok (mtr ${mtr.length}, kmb routes ${routes.size})`);
