#!/usr/bin/env node
/**
 * Build the New Lantao Bus stop catalogue for 去邊.
 *
 *   node scripts/build-nlb-stops.js
 *
 * Stop names and coordinates come from the official NLB open data (no auth, CORS *):
 *   GET https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list
 *   GET https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId={routeId}
 *
 * Live ETA in the app uses the DPO batch feed, which takes these same stop ids
 * unpadded: https://rt.data.gov.hk/v1/transport/batch/stop-eta/NLB/{stop}
 * A zero-padded id returns HTTP 500, so ids are stored as the API returns them.
 *
 * Writes compact JSON:
 *   data/nlb-stops.json   — type/id/name_tc/name_en/bound_tc/lat/lng/routes
 *   data/nlb-routes.json  — route termini, per-stop route ids, English→Chinese places
 *
 * Requests are throttled. A cache in /tmp/heui-bin-nlb-cache.json lets a rerun resume.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE = process.env.NLB_CACHE || '/tmp/heui-bin-nlb-cache.json';
const BASE = 'https://rt.data.gov.hk/v2/transport/nlb';
const CONCURRENCY = Number(process.env.NLB_CONCURRENCY || 4);
const UA = 'heui-bin-nlb-catalogue/1.0';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  } catch {
    return { routes: null, stops: {} };
  }
}

function saveCache(cache) {
  const tmp = `${CACHE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache));
  fs.renameSync(tmp, CACHE);
}

function nlbNorm(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function routeSort(a, b) {
  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

function splitEnds(text) {
  const parts = String(text ?? '').split(/\s*>\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { o: parts[0] || '', d: '' };
  return { o: parts[0], d: parts[parts.length - 1] };
}

let pauseUntil = 0;

async function getJson(url, attempt = 0) {
  const wait = pauseUntil - Date.now();
  if (wait > 0) await sleep(wait);
  let res;
  try {
    res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  } catch (err) {
    if (attempt >= 5) throw err;
    await sleep(400 * (attempt + 1));
    return getJson(url, attempt + 1);
  }
  if (res.status === 429 || res.status >= 500) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * (attempt + 1);
    pauseUntil = Math.max(pauseUntil, Date.now() + delay);
    if (attempt >= 6) throw new Error(`${res.status} ${url}`);
    await sleep(delay);
    return getJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const cors = res.headers.get('access-control-allow-origin');
  if (cors !== '*') throw new Error(`expected CORS *, got ${cors || '(none)'} for ${url}`);
  return res.json();
}

async function pool(items, worker) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => run()));
}

async function main() {
  const cache = loadCache();
  if (!cache.routes) {
    const doc = await getJson(`${BASE}/route.php?action=list`);
    cache.routes = doc.routes || [];
    saveCache(cache);
  }
  const routes = cache.routes.filter((row) => row && row.routeId && row.routeNo);
  console.log(`routes ${routes.length}`);

  const book = {};
  for (const row of routes) {
    const zh = splitEnds(row.routeName_c);
    const en = splitEnds(row.routeName_e);
    if (!zh.d || !en.d) console.log(`unsplit ${row.routeId} ${row.routeNo} ${row.routeName_c} | ${row.routeName_e}`);
    book[String(row.routeId)] = {
      no: String(row.routeNo).trim(),
      o: zh.o,
      d: zh.d,
      oe: en.o,
      de: en.d,
    };
  }

  let done = 0;
  await pool(routes, async (row) => {
    const id = String(row.routeId);
    if (!cache.stops[id]) {
      const doc = await getJson(`${BASE}/stop.php?action=list&routeId=${encodeURIComponent(id)}`);
      cache.stops[id] = (doc.stops || []).map((stop) => ({
        stopId: String(stop.stopId ?? '').trim(),
        name_tc: String(stop.stopName_c || '').trim(),
        name_en: String(stop.stopName_e || '').trim(),
        lat: stop.latitude,
        lng: stop.longitude,
      }));
      saveCache(cache);
    }
    done += 1;
    if (done % 15 === 0 || done === routes.length) console.log(`route stops ${done}/${routes.length}`);
  });

  const byStop = new Map();
  for (const row of routes) {
    const info = book[String(row.routeId)];
    const stops = cache.stops[String(row.routeId)] || [];
    for (const stop of stops) {
      if (!stop.stopId || !/^\d+$/.test(stop.stopId)) continue;
      let entry = byStop.get(stop.stopId);
      if (!entry) {
        entry = { stop, routes: new Set(), routeIds: new Set(), bounds: new Set() };
        byStop.set(stop.stopId, entry);
      }
      if (/^[A-Za-z0-9]+$/.test(info.no)) entry.routes.add(info.no);
      entry.routeIds.add(String(row.routeId));
      if (info.d) entry.bounds.add(info.d);
    }
  }

  const places = {};
  function addPlace(en, zh) {
    const key = nlbNorm(en);
    const name = String(zh || '').trim();
    if (!key || !name || !/[\u4e00-\u9fff]/.test(name)) return;
    if (places[key] && places[key] !== name) return;
    places[key] = name;
  }

  const stops = [];
  for (const [id, entry] of byStop) {
    const raw = entry.stop;
    if (!raw.name_tc) continue;
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const item = {
      type: 'nlb',
      id,
      name_tc: raw.name_tc,
      name_en: raw.name_en,
      bound_tc: [...entry.bounds].sort((a, b) => a.localeCompare(b, 'zh-Hant')).slice(0, 8).map((name) => `往${name}`).join('／'),
      routes: [...entry.routes].sort(routeSort),
    };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      item.lat = Math.round(lat * 1e6) / 1e6;
      item.lng = Math.round(lng * 1e6) / 1e6;
    }
    if (!item.routes.length) continue;
    stops.push(item);
    addPlace(raw.name_en, raw.name_tc);
  }
  stops.sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));

  for (const info of Object.values(book)) {
    addPlace(info.oe, info.o);
    addPlace(info.de, info.d);
  }
  // Short names used in routeVariantName / parenthetical dests, not as a whole stop name.
  for (const [en, zh] of [
    ['Shui Hau', '水口'],
    ['Sha Tsui', '沙咀'],
    ['Pui O', '貝澳'],
    ['Mui Wo Old Town', '梅窩舊墟'],
  ]) addPlace(en, zh);

  const byStopOut = {};
  for (const [id, entry] of byStop) {
    if (!stops.some((stop) => stop.id === id)) continue;
    byStopOut[id] = [...entry.routeIds].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  }

  const stopsPath = path.join(ROOT, 'data', 'nlb-stops.json');
  const routesPath = path.join(ROOT, 'data', 'nlb-routes.json');
  fs.writeFileSync(stopsPath, JSON.stringify(stops));
  fs.writeFileSync(routesPath, JSON.stringify({ routes: book, byStop: byStopOut, places }));
  console.log(`wrote ${stops.length} stops, ${Object.keys(book).length} routes, ${Object.keys(places).length} places`);
  console.log(stopsPath);
  console.log(routesPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
