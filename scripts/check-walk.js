/* Locks the stop-detail walk estimate and the Google Maps link. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rev = fs.readFileSync(path.join(__dirname, '..', 'rev.txt'), 'utf8').trim();
const bundlePath = path.join(__dirname, '..', 'assets', `index-${rev}.js`);
const src = fs.readFileSync(bundlePath, 'utf8');
const start = src.indexOf('/* WALK_BEGIN */');
const end = src.indexOf('/* WALK_END */');
assert.ok(start >= 0 && end > start, 'walk helpers missing from the snapshot bundle');
const body = src.slice(start, end);

function haversine(a, b) {
  const rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function nearest(origin, stop) {
  if (stop.exits && stop.exits.length) return Math.min(...stop.exits.map((exit) => haversine(origin, exit)));
  if (typeof stop.lat === 'number' && typeof stop.lng === 'number') return haversine(origin, { lat: stop.lat, lng: stop.lng });
  return null;
}
function hasCoords(stop) {
  return !!(stop.exits && stop.exits.length) || (typeof stop.lat === 'number' && typeof stop.lng === 'number');
}

const api = new Function('Ae', 'Me', 'Ne', `
  let R = null;
  let St = 'idle';
  ${body}
  return {
    WALK_MPM,
    walkCopy,
    walkPoint,
    mapsHref,
    walkHtml,
    set(pos, state) { R = pos; St = state; }
  };
`)(haversine, hasCoords, nearest);

assert.strictEqual(api.WALK_MPM, 80);
assert.match(body, /4\.8 km\/h/);
assert.strictEqual(api.walkCopy(0), '步行少於 1 分鐘');
assert.strictEqual(api.walkCopy(39), '步行少於 1 分鐘');
assert.strictEqual(api.walkCopy(40), '步行約 1 分鐘');
assert.strictEqual(api.walkCopy(80), '步行約 1 分鐘');
assert.strictEqual(api.walkCopy(200), '步行約 3 分鐘');
assert.strictEqual(api.walkCopy(400), '步行約 5 分鐘');
assert.strictEqual(api.walkCopy(30 * 80), '步行約 30 分鐘');
assert.strictEqual(api.walkCopy(31 * 80), '');
assert.strictEqual(api.walkCopy(22000), '');
assert.strictEqual(api.walkCopy(null), '');
assert.strictEqual(api.walkCopy(Number.NaN), '');

const stop = { lat: 22.28181, lng: 114.15722, name_tc: '中環' };
assert.strictEqual(api.walkHtml({ name_tc: '海皇路' }), '');

api.set(null, 'denied');
const denied = api.walkHtml(stop);
assert.ok(!denied.includes('eta-walk-mins'), 'minutes stay hidden without a fix');
assert.match(denied, /target="_blank"/);
assert.match(denied, /rel="noopener noreferrer"/);
assert.match(denied, />步行路線</);
assert.match(denied, /https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=22\.281810,114\.157220&travelmode=walking/);
assert.ok(!denied.includes('origin='));

const here = { lat: 22.279, lng: 114.16485 };
api.set(here, 'ok');
const ready = api.walkHtml(stop);
const meters = haversine(here, stop);
assert.match(ready, new RegExp(api.walkCopy(meters).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(ready, /origin=22\.279000,114\.164850/);
assert.match(ready, /destination=22\.281810,114\.157220/);
assert.match(ready, /travelmode=walking/);

const exits = {
  lat: 22.43,
  lng: 114.24,
  exits: [
    { lat: 22.42974, lng: 114.24375 },
    { lat: 22.42906, lng: 114.24387 }
  ]
};
const near = { lat: 22.429, lng: 114.2438 };
api.set(near, 'ok');
const pin = api.walkPoint(exits, near);
assert.ok(Math.abs(pin.lat - 22.42906) < 1e-9, 'directions use the nearer exit');
assert.match(api.mapsHref(exits), /destination=22\.429060,114\.243870/);
assert.match(api.walkHtml(exits), /步行少於 1 分鐘/);

const bundleHasUi = src.includes('${walkHtml(n)}') && src.includes('z?walkPaint():Dt()');
assert.ok(bundleHasUi, 'ETA header must render the walk row without waiting on it');
assert.ok(src.includes('walkPaint()'), 'a later location fix must fill in the minutes');

console.log('walk ui ok');
