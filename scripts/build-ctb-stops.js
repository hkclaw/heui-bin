#!/usr/bin/env node
/**
 * Build the Citybus stop catalogue for 去邊.
 *
 * Post–July 2023 merger, Citybus and the former NWFB network are one feed.
 * This script only reads company_id CTB. It does not write an NWFB brand.
 *
 *   node scripts/build-ctb-stops.js
 *
 * Sources (no auth, CORS *):
 *   GET https://rt.data.gov.hk/v2/transport/citybus/route/CTB
 *   GET https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/{route}/{inbound|outbound}
 *   GET https://rt.data.gov.hk/v2/transport/citybus/stop/{stop_id}
 *
 * Writes compact JSON, same shape as data/kmb-stops.json:
 *   data/ctb-stops.json   — type/id/name_tc/name_en/bound_tc/lat/lng/routes
 *   data/ctb-routes.json  — route termini, so live ETA can show Chinese destinations
 *
 * Stop ids are zero-padded to 6 digits. Requests are throttled and retried on HTTP 429.
 * A partial cache in /tmp/heui-bin-ctb-cache.json lets a rerun resume.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE = process.env.CTB_CACHE || '/tmp/heui-bin-ctb-cache.json';
const BASE = 'https://rt.data.gov.hk/v2/transport/citybus';
const CONCURRENCY = Number(process.env.CTB_CONCURRENCY || 5);
const UA = 'heui-bin-ctb-catalogue/1.0';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  } catch {
    return { routeStops: {}, stops: {} };
  }
}

function saveCache(cache) {
  const tmp = `${CACHE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache));
  fs.renameSync(tmp, CACHE);
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
  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
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

function padStop(id) {
  const text = String(id ?? '').trim();
  return /^\d+$/.test(text) ? text.padStart(6, '0') : text;
}

function routeSort(a, b) {
  return a.localeCompare(b, 'en', { numeric: true });
}

async function main() {
  const cache = loadCache();
  const routeDoc = await getJson(`${BASE}/route/CTB`);
  const routes = (routeDoc && routeDoc.data) || [];
  const book = {};
  const routeNos = [];
  for (const row of routes) {
    if (!row || row.co !== 'CTB' || !row.route) continue;
    const route = String(row.route).trim();
    if (!/^[A-Za-z0-9]+$/.test(route)) continue;
    routeNos.push(route);
    book[route] = {
      o: String(row.orig_tc || '').trim(),
      d: String(row.dest_tc || '').trim(),
      oe: String(row.orig_en || '').trim(),
      de: String(row.dest_en || '').trim(),
    };
  }
  routeNos.sort(routeSort);
  console.log(`routes ${routeNos.length}`);

  const jobs = [];
  for (const route of routeNos) {
    for (const dir of ['outbound', 'inbound']) {
      jobs.push({ route, dir, key: `${route}/${dir}` });
    }
  }
  let done = 0;
  await pool(jobs, async (job) => {
    if (!cache.routeStops[job.key]) {
      const doc = await getJson(`${BASE}/route-stop/CTB/${encodeURIComponent(job.route)}/${job.dir}`);
      const rows = ((doc && doc.data) || []).filter((row) => row && (!row.co || row.co === 'CTB'));
      cache.routeStops[job.key] = rows.map((row) => ({
        stop: padStop(row.stop),
        dir: row.dir === 'I' ? 'I' : 'O',
        seq: Number(row.seq) || 0,
      }));
      if ((done + 1) % 40 === 0) saveCache(cache);
    }
    done += 1;
    if (done % 80 === 0 || done === jobs.length) console.log(`route-stop ${done}/${jobs.length}`);
  });
  saveCache(cache);

  const byStop = new Map();
  for (const route of routeNos) {
    const info = book[route];
    for (const dir of ['outbound', 'inbound']) {
      const rows = cache.routeStops[`${route}/${dir}`] || [];
      for (const row of rows) {
        if (!row.stop) continue;
        let entry = byStop.get(row.stop);
        if (!entry) {
          entry = { routes: new Set(), bounds: new Set() };
          byStop.set(row.stop, entry);
        }
        entry.routes.add(route);
        const bound = row.dir === 'I' ? info.o : info.d;
        if (bound) entry.bounds.add(bound);
      }
    }
  }
  const stopIds = [...byStop.keys()].sort();
  console.log(`unique stops ${stopIds.length}`);

  let fetched = 0;
  await pool(stopIds, async (id) => {
    if (!cache.stops[id]) {
      const doc = await getJson(`${BASE}/stop/${encodeURIComponent(id)}`);
      const row = doc && doc.data;
      cache.stops[id] = row && row.stop
        ? {
            stop: padStop(row.stop),
            name_tc: String(row.name_tc || '').trim(),
            name_en: String(row.name_en || '').trim(),
            lat: row.lat,
            lng: row.long ?? row.lng,
          }
        : { missing: true };
      if ((fetched + 1) % 50 === 0) saveCache(cache);
    }
    fetched += 1;
    if (fetched % 200 === 0 || fetched === stopIds.length) console.log(`stops ${fetched}/${stopIds.length}`);
  });
  saveCache(cache);

  const stops = [];
  let missing = 0;
  for (const id of stopIds) {
    const raw = cache.stops[id];
    const meta = byStop.get(id);
    if (!raw || raw.missing || !raw.name_tc) {
      missing += 1;
      continue;
    }
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const item = {
      type: 'ctb',
      id: padStop(raw.stop || id),
      name_tc: raw.name_tc,
      name_en: raw.name_en,
      bound_tc: [...meta.bounds].sort((a, b) => a.localeCompare(b, 'zh-Hant')).slice(0, 8).map((name) => `往${name}`).join('／'),
      routes: [...meta.routes].sort(routeSort),
    };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      item.lat = Math.round(lat * 1e6) / 1e6;
      item.lng = Math.round(lng * 1e6) / 1e6;
    }
    if (!item.routes.length || !/^\d{6}$/.test(item.id)) continue;
    stops.push(item);
  }
  stops.sort((a, b) => a.id.localeCompare(b.id));

  const stopsPath = path.join(ROOT, 'data', 'ctb-stops.json');
  const routesPath = path.join(ROOT, 'data', 'ctb-routes.json');
  fs.writeFileSync(stopsPath, JSON.stringify(stops));
  const routeOut = {};
  for (const route of routeNos) routeOut[route] = book[route];
  fs.writeFileSync(routesPath, JSON.stringify(routeOut));
  console.log(`wrote ${stops.length} stops, ${routeNos.length} routes, missing ${missing}`);
  console.log(stopsPath);
  console.log(routesPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
