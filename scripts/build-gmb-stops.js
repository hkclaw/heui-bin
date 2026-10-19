#!/usr/bin/env node
/**
 * Build the green-minibus (專線小巴) stop catalogue for 去邊.
 *
 * The Transport Department ETA API has no bulk stop list. This walks
 * region → route → route-stop, then asks /stop/{id} for WGS84 coordinates.
 * Live ETA stays on the phone: GET https://data.etagmb.gov.hk/eta/stop/{id}
 * (no auth, Access-Control-Allow-Origin: * when Origin is sent).
 *
 *   node scripts/build-gmb-stops.js
 *
 * Sources:
 *   GET https://data.etagmb.gov.hk/route
 *   GET https://data.etagmb.gov.hk/route/{region}/{route_code}
 *   GET https://data.etagmb.gov.hk/route-stop/{route_id}/{route_seq}
 *   GET https://data.etagmb.gov.hk/stop/{stop_id}
 *
 * Writes:
 *   data/gmb-stops.json   — stops, same shape as data/kmb-stops.json plus aka
 *   data/gmb-routes.json  — "{route_id}:{route_seq}" → {code, dest}
 *
 * A partial cache in /tmp/heui-bin-gmb-cache.json lets a rerun resume.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE = process.env.GMB_CACHE || '/tmp/heui-bin-gmb-cache.json';
const BASE = 'https://data.etagmb.gov.hk';
const CONCURRENCY = Number(process.env.GMB_CONCURRENCY || 8);
const UA = 'heui-bin-gmb-catalogue/1.0';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  } catch {
    return { routes: {}, routeStops: {}, stops: {} };
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
    res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'application/json',
        origin: 'https://heuibin.codecoffee.online',
      },
    });
  } catch (err) {
    if (attempt >= 5) throw err;
    await sleep(400 * (attempt + 1));
    return getJson(url, attempt + 1);
  }
  if (res.status === 429 || res.status === 403 || res.status >= 500) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * (attempt + 1);
    pauseUntil = Math.max(pauseUntil, Date.now() + delay);
    if (attempt >= 8) throw new Error(`${res.status} ${url}`);
    await sleep(delay);
    return getJson(url, attempt + 1);
  }
  if (res.status === 404) return null;
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
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length || 1) }, () => run()));
}

function routeSort(a, b) {
  return a.localeCompare(b, 'en', { numeric: true });
}

function shortDest(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  text = text.replace(/[（(]\s*循環線\s*[）)]/g, '').trim();
  if (text.length > 22) text = text.replace(/[（(][^）)]*[）)]/g, '').replace(/\s+/g, ' ').trim();
  return text || String(value || '').trim();
}

function boundOf(dests) {
  const seen = [];
  for (const dest of dests) {
    const text = shortDest(dest);
    if (!text || seen.includes(text)) continue;
    seen.push(text);
    if (seen.length >= 4) break;
  }
  return seen.map((text) => (text.startsWith('往') ? text : `往${text}`)).join('／');
}

async function main() {
  const cache = loadCache();
  const listing = await getJson(`${BASE}/route`);
  const byRegion = (listing && listing.data && listing.data.routes) || {};
  const jobs = [];
  for (const region of ['HKI', 'KLN', 'NT']) {
    for (const code of byRegion[region] || []) {
      const route = String(code).trim();
      if (!/^[A-Za-z0-9]+$/.test(route)) {
        console.warn(`skip route code ${region}/${code}`);
        continue;
      }
      jobs.push({ region, route });
    }
  }
  console.log(`route codes ${jobs.length}`);

  let routeDone = 0;
  await pool(jobs, async (job) => {
    const key = `${job.region}:${job.route}`;
    if (!cache.routes[key]) {
      const body = await getJson(`${BASE}/route/${job.region}/${encodeURIComponent(job.route)}`);
      const rows = body && body.data;
      cache.routes[key] = Array.isArray(rows) ? rows : [];
    }
    routeDone += 1;
    if (routeDone % 40 === 0) {
      saveCache(cache);
      console.log(`routes ${routeDone}/${jobs.length}`);
    }
  });
  saveCache(cache);

  const directions = [];
  for (const job of jobs) {
    for (const variant of cache.routes[`${job.region}:${job.route}`] || []) {
      const routeId = variant && variant.route_id;
      if (routeId == null) continue;
      for (const dir of variant.directions || []) {
        if (!dir || dir.route_seq == null) continue;
        directions.push({
          routeId: String(routeId),
          seq: String(dir.route_seq),
          code: String(variant.route_code || job.route).trim(),
          dest: String(dir.dest_tc || '').trim(),
        });
      }
    }
  }
  console.log(`directions ${directions.length}`);

  const book = {};
  let rsDone = 0;
  await pool(directions, async (dir) => {
    const key = `${dir.routeId}:${dir.seq}`;
    book[key] = { code: dir.code, dest: shortDest(dir.dest) };
    if (!cache.routeStops[key]) {
      const body = await getJson(`${BASE}/route-stop/${dir.routeId}/${dir.seq}`);
      const rows = body && body.data && body.data.route_stops;
      cache.routeStops[key] = Array.isArray(rows) ? rows : [];
    }
    rsDone += 1;
    if (rsDone % 50 === 0) {
      saveCache(cache);
      console.log(`route-stops ${rsDone}/${directions.length}`);
    }
  });
  saveCache(cache);

  const acc = new Map();
  for (const dir of directions) {
    const key = `${dir.routeId}:${dir.seq}`;
    const stops = cache.routeStops[key] || [];
    for (const row of stops) {
      if (!row || row.stop_id == null) continue;
      const id = String(row.stop_id);
      let stop = acc.get(id);
      if (!stop) {
        stop = {
          names: new Map(),
          ens: new Map(),
          routes: new Set(),
          dests: [],
        };
        acc.set(id, stop);
      }
      const nameTc = String(row.name_tc || '').trim();
      const nameEn = String(row.name_en || '').trim();
      if (nameTc) stop.names.set(nameTc, (stop.names.get(nameTc) || 0) + 1);
      if (nameEn) stop.ens.set(nameEn, (stop.ens.get(nameEn) || 0) + 1);
      if (/^[A-Za-z0-9]+$/.test(dir.code)) stop.routes.add(dir.code);
      if (dir.dest && !stop.dests.includes(dir.dest)) stop.dests.push(dir.dest);
    }
  }
  const ids = [...acc.keys()];
  console.log(`unique stops ${ids.length}`);

  let stopDone = 0;
  await pool(ids, async (id) => {
    if (!cache.stops[id]) {
      const body = await getJson(`${BASE}/stop/${id}`);
      const data = body && body.data;
      const wgs = data && data.coordinates && data.coordinates.wgs84;
      cache.stops[id] = {
        lat: wgs && Number.isFinite(Number(wgs.latitude)) ? Number(wgs.latitude) : null,
        lng: wgs && Number.isFinite(Number(wgs.longitude)) ? Number(wgs.longitude) : null,
        enabled: !data || data.enabled !== false,
      };
    }
    stopDone += 1;
    if (stopDone % 80 === 0) {
      saveCache(cache);
      console.log(`coords ${stopDone}/${ids.length}`);
    }
  });
  saveCache(cache);

  function pickName(counts) {
    let best = '';
    let bestN = -1;
    for (const [name, count] of counts) {
      if (count > bestN || (count === bestN && name.length < best.length)) {
        best = name;
        bestN = count;
      }
    }
    return best;
  }

  const stops = [];
  let missingCoord = 0;
  for (const id of ids) {
    const raw = acc.get(id);
    const coord = cache.stops[id] || {};
    const nameTc = pickName(raw.names);
    const nameEn = pickName(raw.ens);
    if (!nameTc) continue;
    const aka = [];
    for (const name of raw.names.keys()) {
      if (name !== nameTc && aka.length < 6) aka.push(name);
    }
    for (const name of raw.ens.keys()) {
      if (name && name.toLowerCase() !== nameEn.toLowerCase() && aka.length < 8) aka.push(name);
    }
    const stop = {
      type: 'gmb',
      id,
      name_tc: nameTc,
      name_en: nameEn,
      bound_tc: boundOf(raw.dests),
      routes: [...raw.routes].sort(routeSort),
    };
    if (aka.length) stop.aka = aka;
    if (coord.lat != null && coord.lng != null) {
      stop.lat = Math.round(coord.lat * 1e6) / 1e6;
      stop.lng = Math.round(coord.lng * 1e6) / 1e6;
    } else {
      missingCoord += 1;
    }
    if (!stop.routes.length) continue;
    stops.push(stop);
  }
  stops.sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));

  const stopPath = path.join(ROOT, 'data', 'gmb-stops.json');
  const routePath = path.join(ROOT, 'data', 'gmb-routes.json');
  fs.writeFileSync(stopPath, JSON.stringify(stops));
  fs.writeFileSync(routePath, JSON.stringify(book));
  console.log(`wrote ${stops.length} stops, ${Object.keys(book).length} directions, ${missingCoord} without coordinates`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
