/* Opt-in 落車提醒. Distinct from the station arrival reminder (到站提醒).
   The page watches the device position and notifies once inside ~250 m of a
   destination stop on the selected route. If location is denied, the user can
   pick a countdown instead. Nothing runs until they tap. iOS may suspend the
   page when it is locked or backgrounded, so the watch and the timer can miss.
   Location stays on the device. */
(function (root) {
  'use strict';

  var RADIUS_M = 250;
  var COARSE_M = 300;
  var TIGHT_M = 80;
  var NEAR_EXCLUDE_M = 180;
  var ALREADY_ACC_M = 150;
  var MINUTES = [5, 10, 15, 20];
  var OFF_KEY = 'tap-eta-alight-off-v1';
  var NOTIFY_TAG = 'heui-bin-alight';
  var LIMIT_COPY = '你喺車上先開，同到站提醒唔同。近落車站約 250 米通知一次；定位未開就改倒數。要允許通知，iPhone 要由主畫面開。鎖屏或切走 App 可能唔響。開住定位會用多啲電，位置唔會上傳。';
  var PICK_ROUTE = '揀咗路線，就可以揀落車站。';
  var PICK_LRT = '揀路線，再揀落車站。';
  var LOADING = '讀取沿線車站…';
  var EMPTY = '呢條線暫時冇可揀嘅落車站。';
  var UNORDERED = '沿線路序暫時唔齊，請對住站名。';
  var TIME_HINT = '定位未開。揀幾多分鐘後提醒（畫面要開住）。';
  var ALREADY_NOTE = '你已經喺呢個站附近，未有開啟。';
  var HOME_NOTE = '要由主畫面嘅「去邊」圖示開啟，先收到落車通知。';
  var DENIED_NOTE = '通知未開。去系統設定允許「去邊」通知，再撳一次。';
  var UNSUPPORTED_NOTE = '呢部機唔支援通知';

  function haversine(a, b) {
    if (!a || !b || !isFinite(a.lat) || !isFinite(a.lng) || !isFinite(b.lat) || !isFinite(b.lng)) return NaN;
    var rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad;
    var dLng = (b.lng - a.lng) * rad;
    var lat1 = a.lat * rad;
    var lat2 = b.lat * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function shortName(name) {
    var text = String(name || '').replace(/\s*[（(][^）)]*[）)]\s*/g, ' ').replace(/\s+/g, ' ').trim();
    return text || String(name || '');
  }

  function chipLabels(stops) {
    var counts = {};
    var names = (stops || []).map(function (stop) { return shortName(stop && stop.name); });
    names.forEach(function (name) { counts[name] = (counts[name] || 0) + 1; });
    return (stops || []).map(function (stop, index) {
      var name = names[index];
      if (counts[name] < 2) return name;
      var code = String(stop.name || '').match(/[（(]([^）)]+)[）)]/);
      return code ? name + ' ' + code[1] : name;
    });
  }

  function normalizeMinutes(value) {
    var n = parseInt(value, 10);
    for (var i = 0; i < MINUTES.length; i++) if (MINUTES[i] === n) return n;
    return null;
  }

  function readOff(storage) {
    try { return !!(storage && storage.getItem(OFF_KEY) === '1'); } catch (e) { return false; }
  }

  function writeOff(storage, off) {
    try { if (storage) storage.setItem(OFF_KEY, off ? '1' : '0'); } catch (e) {}
  }

  function offerType(type) {
    return type === 'kmb' || type === 'ctb' || type === 'lrt';
  }

  function pageContext(hash, chipRoute) {
    var parts = String(hash || '').replace(/^#/, '').split('/').filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      try { parts[i] = decodeURIComponent(parts[i]); } catch (e) {}
    }
    if (parts[0] === 'eta' && parts[1] && parts[2]) {
      var type = parts[1] === 'tml' ? 'mtr' : parts[1];
      var route = parts[3] || '';
      if (chipRoute) route = chipRoute;
      return { page: 'eta', type: type, id: parts[2], route: route };
    }
    if (parts[0] === 'route' && parts[1]) return { page: 'route', type: '', id: '', route: parts[1] };
    if (parts[0] === 'settings' || parts[0] === 'about' || parts[0] === 'search') {
      return { page: parts[0], type: '', id: '', route: '' };
    }
    return { page: 'home', type: '', id: '', route: '' };
  }

  function indexStops(rows) {
    var map = new Map();
    (rows || []).forEach(function (stop) {
      if (stop && stop.type && stop.id != null) map.set(stop.type + ':' + stop.id, stop);
    });
    return map;
  }

  function materialize(rows, index, type) {
    var sorted = (rows || []).slice().sort(function (a, b) { return Number(a.seq) - Number(b.seq); });
    var out = [];
    var seen = {};
    sorted.forEach(function (row) {
      var id = String((row && (row.stop || row.id)) || '');
      if (!id || seen[id]) return;
      var stop = index && index.get(type + ':' + id);
      if (!stop || !isFinite(stop.lat) || !isFinite(stop.lng)) return;
      seen[id] = true;
      out.push({ id: id, type: type, name: stop.name_tc, lat: stop.lat, lng: stop.lng });
    });
    return out;
  }

  function ahead(stops, currentIds, origin, opts) {
    var ids = {};
    (currentIds || []).forEach(function (id) { if (id != null && id !== '') ids[String(id)] = true; });
    var idx = -1;
    for (var i = 0; i < (stops || []).length; i++) if (ids[String(stops[i].id)]) { idx = i; break; }
    var unordered = !!(opts && opts.unordered);
    var list = (!unordered && idx >= 0) ? stops.slice(idx + 1) : (stops || []).filter(function (stop) { return !ids[String(stop.id)]; });
    if ((unordered || idx < 0) && origin && isFinite(origin.lat) && isFinite(origin.lng)) {
      list = list.filter(function (stop) { return haversine(origin, stop) > NEAR_EXCLUDE_M; });
    }
    return list;
  }

  function buildDirections(sequences, currentIds, origin) {
    var ids = (currentIds || []).map(String);
    var dirs = [];
    (sequences || []).forEach(function (seq) {
      var stops = seq.stops || [];
      var has = stops.some(function (stop) { return ids.indexOf(String(stop.id)) >= 0; });
      var next = ahead(stops, ids, origin, { unordered: seq.ordered === false });
      if (!next.length) return;
      var last = stops[stops.length - 1];
      dirs.push({
        label: seq.label || (last ? '往' + shortName(last.name) : '沿線'),
        stops: next,
        hasCurrent: has,
        ordered: seq.ordered !== false
      });
    });
    return dirs;
  }

  function localCandidates(stops, type, route, currentIds, origin) {
    var want = String(route || '').toUpperCase();
    var list = [];
    (stops || []).forEach(function (stop) {
      if (!stop || stop.type !== type || !isFinite(stop.lat) || !isFinite(stop.lng)) return;
      var routes = stop.routes || [];
      var hit = routes.some(function (item) { return String(item).toUpperCase() === want; });
      if (!hit) return;
      list.push({ id: String(stop.id), type: type, name: stop.name_tc, lat: stop.lat, lng: stop.lng });
    });
    return ahead(list, currentIds, origin, { unordered: true });
  }

  function lrtDirections(book, index, route, currentIds, origin) {
    var seqs = (book && (book[route] || book[String(route)])) || [];
    var sequences = [];
    seqs.forEach(function (seq) {
      var stops = [];
      ((seq && seq.stops) || []).forEach(function (item) {
        var id = String(item.id);
        var station = index && index.get('lrt:' + id);
        if (!station || !isFinite(station.lat) || !isFinite(station.lng)) return;
        stops.push({ id: id, type: 'lrt', name: item.name || station.name_tc, lat: station.lat, lng: station.lng });
      });
      if (!stops.length) return;
      sequences.push({
        label: '往' + (seq.dest || shortName(stops[stops.length - 1].name)),
        stops: stops,
        ordered: true
      });
    });
    return buildDirections(sequences, currentIds, origin);
  }

  function pickDirIndex(dirs, preferIndex) {
    if (!dirs || !dirs.length) return 0;
    if (preferIndex != null && dirs[preferIndex]) return preferIndex;
    for (var i = 0; i < dirs.length; i++) if (dirs[i].hasCurrent) return i;
    return 0;
  }

  function consider(distanceM, accuracyM, streak) {
    var count = streak || 0;
    if (!isFinite(distanceM)) return { streak: 0, notify: false };
    if (isFinite(accuracyM) && accuracyM > COARSE_M) return { streak: 0, notify: false };
    if (distanceM > RADIUS_M) return { streak: 0, notify: false };
    var next = count + 1;
    var tight = isFinite(accuracyM) && accuracyM <= TIGHT_M;
    return { streak: next, notify: tight || next >= 2 };
  }

  function stepWatch(state, distanceM, accuracyM) {
    if (!state || state.fired) return { streak: state ? state.streak : 0, fired: true, notify: false };
    var hit = consider(distanceM, accuracyM, state.streak || 0);
    if (hit.notify) return { streak: 0, fired: true, notify: true };
    return { streak: hit.streak, fired: false, notify: false };
  }

  function alreadyNear(distanceM, accuracyM) {
    if (!isFinite(distanceM) || !isFinite(accuracyM)) return false;
    if (accuracyM > ALREADY_ACC_M) return false;
    return distanceM <= RADIUS_M;
  }

  function notifyBody(route, name) {
    var who = shortName(name);
    return (route ? String(route) + ' ' : '') + '快到' + who + '，準備落車';
  }

  function armedGeoNote(route, name) {
    var who = shortName(name);
    return (route ? String(route) + ' · ' : '') + '近' + who + '約 250 米會通知一次。畫面要開住，鎖屏可能唔響。';
  }

  function armedTimeNote(route, name, minutes) {
    var who = shortName(name);
    return (route ? String(route) + ' · ' : '') + minutes + ' 分鐘後提醒落' + who + '。畫面要開住，鎖屏可能唔響。';
  }

  function liveLabel(session) {
    if (!session || (session.mode !== 'geo' && session.mode !== 'time')) return '';
    var name = shortName(session.dest && session.dest.name);
    if (session.mode === 'time') return '落車提醒緊 · ' + session.minutes + ' 分鐘後 · ' + name;
    return '落車提醒緊 · ' + name;
  }

  function blankView() {
    return {
      show: false,
      limit: LIMIT_COPY,
      hint: '',
      routes: [],
      dirs: [],
      stops: [],
      arm: false,
      armEnabled: false,
      cancel: false,
      useTime: false,
      minutes: false,
      retryGeo: false,
      note: ''
    };
  }

  function viewModel(input) {
    var o = input || {};
    var base = blankView();
    if (o.disabled) return base;
    if (o.phase === 'geo' || o.phase === 'time') {
      base.show = true;
      base.cancel = true;
      base.useTime = o.phase === 'geo';
      base.note = o.phase === 'geo' ? armedGeoNote(o.route, o.destName) : armedTimeNote(o.route, o.destName, o.minutes);
      return base;
    }
    if (o.page === 'eta' && !offerType(o.type)) return base;
    if (o.page !== 'eta' && o.page !== 'route') return base;
    if (o.page === 'route' && !o.loading && (!o.directions || !o.directions.length)) return base;
    base.show = true;
    if (o.page === 'eta' && !o.route) {
      if (o.type === 'lrt') {
        base.hint = o.routeChoices && o.routeChoices.length ? PICK_LRT : EMPTY;
        base.routes = o.routeChoices || [];
        return base;
      }
      base.hint = PICK_ROUTE;
      return base;
    }
    if (o.loading) {
      base.hint = LOADING;
      return base;
    }
    var dirs = o.directions || [];
    if (!dirs.length) {
      base.hint = EMPTY;
      return base;
    }
    var dirIndex = pickDirIndex(dirs, o.dirIndex);
    var dir = dirs[dirIndex];
    base.dirs = dirs.map(function (item, index) {
      return { label: item.label, on: index === dirIndex, index: index };
    });
    var labels = chipLabels(dir.stops);
    base.stops = dir.stops.map(function (stop, index) {
      return {
        id: stop.id,
        type: stop.type || o.type || '',
        label: labels[index],
        on: String(stop.id) === String(o.selectedId)
      };
    });
    if (dir.ordered === false) base.hint = UNORDERED;
    var selected = base.stops.some(function (stop) { return stop.on; });
    base.arm = base.stops.length > 0 && !o.geoDenied;
    base.armEnabled = base.arm && selected && !o.busy;
    base.minutes = !!o.geoDenied && selected;
    base.retryGeo = !!o.geoDenied;
    if (o.busy) base.note = '定位中…';
    else if (o.banner) base.note = o.banner;
    else if (base.minutes) base.note = TIME_HINT;
    return base;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderBlock(vm) {
    if (!vm || !vm.show) return '';
    var html = '<section class="alight-block" aria-label="落車提醒">';
    html += '<div class="list-head"><p class="section-label">落車提醒</p></div>';
    html += '<p class="hint alight-limit">' + esc(vm.limit) + '</p>';
    if (vm.hint) html += '<p class="hint alight-hint">' + esc(vm.hint) + '</p>';
    if (vm.routes && vm.routes.length) {
      html += '<div class="alight-routes route-chips" role="group" aria-label="路線">';
      vm.routes.forEach(function (route) {
        html += '<button type="button" class="route-chip' + (route.on ? ' on' : '') + '" data-alight-route="' + esc(route.id) + '" aria-pressed="' + (route.on ? 'true' : 'false') + '">' + esc(route.label || route.id) + '</button>';
      });
      html += '</div>';
    }
    if (vm.dirs && vm.dirs.length) {
      html += '<div class="alight-dirs" role="group" aria-label="方向">';
      vm.dirs.forEach(function (dir) {
        html += '<button type="button" class="alight-dir' + (dir.on ? ' on' : '') + '" data-alight-dir="' + dir.index + '" aria-pressed="' + (dir.on ? 'true' : 'false') + '">' + esc(dir.label) + '</button>';
      });
      html += '</div>';
    }
    if (vm.stops && vm.stops.length) {
      html += '<div class="alight-stops" role="listbox" aria-label="落車站">';
      vm.stops.forEach(function (stop) {
        html += '<button type="button" class="alight-stop' + (stop.on ? ' on' : '') + '" role="option" data-alight-stop="' + esc(stop.id) + '" data-alight-type="' + esc(stop.type) + '" aria-selected="' + (stop.on ? 'true' : 'false') + '">' + esc(stop.label) + '</button>';
      });
      html += '</div>';
    }
    if (vm.cancel) {
      html += '<div class="alight-actions">';
      html += '<button type="button" class="btn btn-ghost alight-cancel" data-alight-cancel>取消落車提醒</button>';
      if (vm.useTime) html += '<button type="button" class="btn btn-ghost" data-alight-use-time>改用倒數</button>';
      html += '</div>';
    } else if (vm.arm) {
      html += '<div class="alight-actions"><button type="button" class="btn btn-ghost alight-arm" data-alight-arm' + (vm.armEnabled ? '' : ' disabled') + '>落車提醒</button></div>';
    }
    if (vm.minutes) {
      html += '<div class="alight-mins" role="group" aria-label="幾多分鐘後提醒">';
      MINUTES.forEach(function (minutes) {
        html += '<button type="button" class="alight-min" data-alight-min="' + minutes + '">' + minutes + ' 分鐘</button>';
      });
      html += '</div>';
    }
    if (vm.retryGeo && !vm.cancel) html += '<div class="alight-actions"><button type="button" class="btn btn-ghost" data-alight-retry-geo>再試定位</button></div>';
    if (vm.note) html += '<p class="alight-note hint" id="alight-note">' + esc(vm.note) + '</p>';
    html += '</section>';
    return html;
  }

  var api = {
    RADIUS_M: RADIUS_M,
    COARSE_M: COARSE_M,
    TIGHT_M: TIGHT_M,
    NEAR_EXCLUDE_M: NEAR_EXCLUDE_M,
    MINUTES: MINUTES,
    OFF_KEY: OFF_KEY,
    NOTIFY_TAG: NOTIFY_TAG,
    LIMIT_COPY: LIMIT_COPY,
    PICK_ROUTE: PICK_ROUTE,
    PICK_LRT: PICK_LRT,
    LOADING: LOADING,
    EMPTY: EMPTY,
    UNORDERED: UNORDERED,
    TIME_HINT: TIME_HINT,
    ALREADY_NOTE: ALREADY_NOTE,
    HOME_NOTE: HOME_NOTE,
    DENIED_NOTE: DENIED_NOTE,
    haversine: haversine,
    shortName: shortName,
    chipLabels: chipLabels,
    normalizeMinutes: normalizeMinutes,
    readOff: readOff,
    writeOff: writeOff,
    offerType: offerType,
    pageContext: pageContext,
    indexStops: indexStops,
    materialize: materialize,
    ahead: ahead,
    buildDirections: buildDirections,
    localCandidates: localCandidates,
    lrtDirections: lrtDirections,
    pickDirIndex: pickDirIndex,
    consider: consider,
    stepWatch: stepWatch,
    alreadyNear: alreadyNear,
    notifyBody: notifyBody,
    armedGeoNote: armedGeoNote,
    armedTimeNote: armedTimeNote,
    liveLabel: liveLabel,
    viewModel: viewModel,
    renderBlock: renderBlock
  };

  var started = false;
  var rawStops = [];
  var index = new Map();
  var lrtBook = null;
  var seqCache = new Map();
  var session = null;
  var watchId = null;
  var timer = null;
  var busy = false;
  var geoDenied = false;
  var banner = '';
  var op = 0;
  var syncGen = 0;
  var painting = false;
  var ui = { selectedId: '', selectedType: '', dirIndex: null, routePick: '', routePickStation: '', key: '' };
  var cache = { key: '', directions: null, loading: false, choices: [] };

  function storage() {
    try { return root.localStorage; } catch (e) { return null; }
  }

  function doc() { return root.document; }

  function fetchJson(url) {
    var ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var timerId = root.setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return root.fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined }).then(function (res) {
      if (!res.ok) throw new Error('bad');
      return res.json();
    }).finally(function () { root.clearTimeout(timerId); });
  }

  function stopWatch() {
    if (watchId != null && root.navigator && root.navigator.geolocation && root.navigator.geolocation.clearWatch) {
      try { root.navigator.geolocation.clearWatch(watchId); } catch (e) {}
    }
    watchId = null;
  }

  function stopTimer() {
    if (timer != null) root.clearTimeout(timer);
    timer = null;
  }

  function clearSession() {
    stopWatch();
    stopTimer();
    session = null;
    busy = false;
  }

  function chipRoute() {
    var document = doc();
    if (!document) return '';
    var chip = document.querySelector('.route-chip.on[data-route-filter]');
    if (!chip) return '';
    var route = chip.getAttribute('data-route-filter') || '';
    if (!route || route === '*') return '';
    return route;
  }

  function currentContext() {
    var ctx = pageContext(root.location ? root.location.hash : '', chipRoute());
    if (ctx.page === 'eta' && ctx.type === 'lrt' && !ctx.route && ui.routePick && ui.routePickStation === ctx.id) {
      ctx = { page: ctx.page, type: ctx.type, id: ctx.id, route: ui.routePick, picked: true };
    }
    return ctx;
  }

  function mountIds() {
    var document = doc();
    var mount = document && document.getElementById('alight-mount');
    if (!mount) return [];
    return String(mount.getAttribute('data-alight-ids') || '').split(',').map(function (id) { return id.trim(); }).filter(Boolean);
  }

  function originFor(type, ids) {
    for (var i = 0; i < ids.length; i++) {
      var stop = index.get(type + ':' + ids[i]);
      if (stop && isFinite(stop.lat) && isFinite(stop.lng)) return { lat: stop.lat, lng: stop.lng };
    }
    return null;
  }

  function lrtChoices(id) {
    var station = index.get('lrt:' + id);
    var routes = (station && station.routes) || [];
    return routes.map(function (route) { return { id: String(route), label: String(route), on: ui.routePick === String(route) }; });
  }

  function stopsFromCards() {
    var document = doc();
    if (!document) return [];
    var cards = document.querySelectorAll('.stop-list .stop-card[data-nav]');
    var out = [];
    var seen = {};
    cards.forEach(function (card) {
      var nav = card.getAttribute('data-nav') || '';
      var match = nav.match(/^\/eta\/(kmb|ctb|lrt|mtr|tml)\/([^/?#]+)/);
      if (!match) return;
      var type = match[1] === 'tml' ? 'mtr' : match[1];
      if (!offerType(type)) return;
      var id = match[2];
      try { id = decodeURIComponent(id); } catch (e) {}
      var stop = index.get(type + ':' + id);
      if (!stop || !isFinite(stop.lat) || !isFinite(stop.lng)) return;
      var key = type + ':' + id;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ id: String(id), type: type, name: stop.name_tc, lat: stop.lat, lng: stop.lng });
    });
    return out;
  }

  function kmbDirection(route, dir, ids) {
    var wanted = {};
    (ids || []).forEach(function (id) { wanted[String(id)] = true; });
    return Promise.all([1, 2, 3].map(function (service) {
      var url = 'https://data.etabus.gov.hk/v1/transport/kmb/route-stop/' + encodeURIComponent(route) + '/' + dir + '/' + service;
      return fetchJson(url).then(function (json) {
        return materialize((json && json.data) || [], index, 'kmb');
      }).catch(function () { return []; });
    })).then(function (options) {
      var best = null;
      var bestScore = -1;
      options.forEach(function (stops) {
        if (!stops.length) return;
        var has = stops.some(function (stop) { return wanted[stop.id]; });
        var score = (has ? 1000 : 0) + stops.length;
        if (score > bestScore) { bestScore = score; best = stops; }
      });
      return best;
    });
  }

  function fetchBusSequences(type, route, ids) {
    var dirs = ['outbound', 'inbound'];
    if (type === 'kmb') {
      return Promise.all(dirs.map(function (dir) {
        return kmbDirection(route, dir, ids).then(function (stops) {
          if (!stops || !stops.length) return null;
          return { label: '往' + shortName(stops[stops.length - 1].name), stops: stops, ordered: true, bound: dir };
        });
      })).then(function (rows) {
        return rows.filter(Boolean).sort(function (a, b) { return a.bound === b.bound ? 0 : (a.bound === 'outbound' ? -1 : 1); });
      });
    }
    return Promise.all(dirs.map(function (dir) {
      var url = 'https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/' + encodeURIComponent(route) + '/' + dir;
      return fetchJson(url).then(function (json) {
        var stops = materialize((json && json.data) || [], index, 'ctb');
        if (!stops.length) return null;
        return { label: '往' + shortName(stops[stops.length - 1].name), stops: stops, ordered: true, bound: dir };
      }).catch(function () { return null; });
    })).then(function (rows) {
      return rows.filter(Boolean).sort(function (a, b) { return a.bound === b.bound ? 0 : (a.bound === 'outbound' ? -1 : 1); });
    });
  }

  function ensureLrt() {
    if (lrtBook) return Promise.resolve(lrtBook);
    return fetchJson('/data/lrt-next.json').then(function (json) {
      lrtBook = json || {};
      return lrtBook;
    }).catch(function () {
      lrtBook = {};
      return lrtBook;
    });
  }

  function loadDirections(ctx, ids, origin) {
    if (ctx.page === 'route') {
      var cards = stopsFromCards();
      if (!cards.length) return Promise.resolve([]);
      return Promise.resolve([{ label: '沿線站', stops: cards, ordered: false, hasCurrent: false }]);
    }
    if (ctx.type === 'lrt') {
      return ensureLrt().then(function (book) {
        return lrtDirections(book, index, ctx.route, ids, origin);
      });
    }
    var key = ctx.type + ':' + String(ctx.route).toUpperCase();
    if (seqCache.has(key)) {
      var cached = seqCache.get(key);
      if (cached && cached.length) return Promise.resolve(buildDirections(cached, ids, origin));
      var local = localCandidates(rawStops, ctx.type, ctx.route, ids, origin);
      if (!local.length) return Promise.resolve([]);
      return Promise.resolve([{ label: '沿線站', stops: local, hasCurrent: false, ordered: false }]);
    }
    return fetchBusSequences(ctx.type, ctx.route, ids).then(function (seqs) {
      seqCache.set(key, seqs || []);
      if (seqs && seqs.length) return buildDirections(seqs, ids, origin);
      var fallback = localCandidates(rawStops, ctx.type, ctx.route, ids, origin);
      if (!fallback.length) return [];
      return [{ label: '沿線站', stops: fallback, hasCurrent: false, ordered: false }];
    });
  }

  function selectedStop() {
    var dirs = cache.directions || [];
    var dir = dirs[ui.dirIndex] || dirs[0];
    if (!dir) return null;
    for (var i = 0; i < dir.stops.length; i++) {
      if (String(dir.stops[i].id) === String(ui.selectedId)) return dir.stops[i];
    }
    return null;
  }

  function modelFor(ctx) {
    if (session && (session.mode === 'geo' || session.mode === 'time')) {
      return viewModel({
        disabled: readOff(storage()),
        phase: session.mode,
        route: session.route,
        destName: session.dest && session.dest.name,
        minutes: session.minutes
      });
    }
    var choices = ctx.type === 'lrt' && !ctx.route ? lrtChoices(ctx.id) : [];
    return viewModel({
      disabled: readOff(storage()),
      page: ctx.page,
      type: ctx.type,
      route: ctx.route,
      routeChoices: choices,
      loading: cache.loading && cache.key === contextKey(ctx),
      directions: cache.key === contextKey(ctx) ? cache.directions : null,
      dirIndex: ui.dirIndex,
      selectedId: ui.selectedId,
      geoDenied: geoDenied,
      busy: busy,
      banner: banner
    });
  }

  function contextKey(ctx) {
    return [ctx.page, ctx.type, ctx.id, ctx.route].join('|');
  }

  function paintSettings() {
    var document = doc();
    if (!document) return;
    var button = document.querySelector('[data-alight-disable]');
    if (!button) return;
    var off = readOff(storage());
    var text = off ? '啟用落車提醒' : '停用落車提醒';
    var pressed = off ? 'false' : 'true';
    if (button.textContent !== text) button.textContent = text;
    if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
  }

  function paintStrip(label) {
    var document = doc();
    if (!document) return;
    var main = document.querySelector('#app .main');
    var el = document.getElementById('alight-live');
    var mount = document.getElementById('alight-mount');
    var mountHasCancel = !!(mount && mount.querySelector('[data-alight-cancel]'));
    if (!label || !main || mountHasCancel) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'alight-live';
      el.className = 'alight-live';
      el.setAttribute('role', 'status');
    }
    if (el.parentNode !== main || main.firstChild !== el) main.insertBefore(el, main.firstChild);
    var html = '<span>' + esc(label) + '</span><button type="button" class="btn btn-ghost" data-alight-cancel>取消</button>';
    if (el.__alightHtml !== html) {
      el.__alightHtml = html;
      el.innerHTML = html;
    }
  }

  function paint() {
    if (painting) return;
    painting = true;
    try {
      var document = doc();
      var mount = document && document.getElementById('alight-mount');
      var ctx = currentContext();
      var vm = modelFor(ctx);
      var html = renderBlock(vm);
      if (mount) {
        if (mount.__alightHtml !== html) {
          mount.__alightHtml = html;
          mount.innerHTML = html;
        }
      }
      var armed = session && (session.mode === 'geo' || session.mode === 'time');
      paintStrip(armed ? liveLabel(session) : '');
      paintSettings();
    } finally {
      painting = false;
    }
  }

  function rememberSelection(dirs) {
    if (ui.dirIndex == null || !dirs[ui.dirIndex]) ui.dirIndex = pickDirIndex(dirs, null);
    var dir = dirs[ui.dirIndex] || dirs[0];
    if (!dir || !dir.stops.some(function (stop) { return String(stop.id) === String(ui.selectedId); })) ui.selectedId = '';
  }

  function sync() {
    var ctx = currentContext();
    var key = contextKey(ctx);
    if (ui.key && ui.key !== key) {
      ui.selectedId = '';
      ui.dirIndex = null;
      banner = '';
      if (!(session && (session.mode === 'geo' || session.mode === 'time'))) geoDenied = false;
    }
    ui.key = key;
    paintSettings();
    if (readOff(storage())) {
      clearSession();
      banner = '';
      cache = { key: key, directions: [], loading: false, choices: [] };
      paint();
      return;
    }
    if (session && (session.mode === 'geo' || session.mode === 'time')) {
      paint();
      return;
    }
    var mount = doc() && doc().getElementById('alight-mount');
    if (!mount) {
      paint();
      return;
    }
    if (ctx.page === 'eta' && !offerType(ctx.type)) {
      cache = { key: key, directions: [], loading: false, choices: [] };
      paint();
      return;
    }
    if (ctx.page === 'eta' && !ctx.route) {
      cache = { key: key, directions: null, loading: false, choices: [] };
      paint();
      return;
    }
    if ((ctx.page === 'eta' || ctx.page === 'route') && index.size === 0) {
      cache = { key: key, directions: null, loading: true, choices: [] };
      paint();
      return;
    }
    if (ctx.page === 'route') {
      var cards = stopsFromCards();
      var listed = cards.length ? [{ label: '沿線站', stops: cards, ordered: false, hasCurrent: false }] : [];
      cache = { key: key, directions: listed, loading: false, choices: [] };
      rememberSelection(listed);
      paint();
      return;
    }
    if (cache.key === key && cache.loading) {
      paint();
      return;
    }
    if (cache.key === key && cache.directions) {
      rememberSelection(cache.directions);
      paint();
      return;
    }
    var ids = mountIds();
    if (ctx.id && ids.indexOf(ctx.id) < 0) ids = [ctx.id].concat(ids);
    var origin = originFor(ctx.type, ids);
    var gen = ++syncGen;
    cache = { key: key, directions: null, loading: true, choices: [] };
    paint();
    loadDirections(ctx, ids, origin).then(function (dirs) {
      if (gen !== syncGen) return;
      dirs = dirs || [];
      cache = { key: key, directions: dirs, loading: false, choices: [] };
      rememberSelection(dirs);
      paint();
    }).catch(function () {
      if (gen !== syncGen) return;
      cache = { key: key, directions: [], loading: false, choices: [] };
      paint();
    });
  }

  function ping(body) {
    var opts = { body: body, tag: NOTIFY_TAG, renotify: false };
    var sw = root.navigator && root.navigator.serviceWorker;
    var viaSw = sw && sw.getRegistration ? sw.getRegistration().then(function (reg) {
      if (reg && typeof reg.showNotification === 'function') return reg.showNotification('去邊 · 落車', opts).then(function () { return true; });
      return false;
    }).catch(function () { return false; }) : Promise.resolve(false);
    return viaSw.then(function (ok) {
      if (ok) return true;
      try {
        if (typeof root.Notification === 'function') {
          new root.Notification('去邊 · 落車', opts);
          return true;
        }
      } catch (e) {}
      return false;
    });
  }

  function fire(token) {
    if (!token || token !== session || token.fired) return;
    token.fired = true;
    var body = notifyBody(token.route, token.dest && token.dest.name);
    clearSession();
    banner = '已提醒一次';
    ping(body).then(function (ok) {
      banner = ok ? '已提醒一次' : '未能通知';
      paint();
    });
    paint();
  }

  function onFix(token, pos) {
    if (!token || token !== session || token.fired) return;
    var coords = (pos && pos.coords) || {};
    if (pos && pos.timestamp && token.armedAt && pos.timestamp + 500 < token.armedAt) return;
    var distance = haversine({ lat: coords.latitude, lng: coords.longitude }, token.dest);
    var step = stepWatch(token, distance, coords.accuracy);
    token.streak = step.streak;
    if (step.notify) fire(token);
  }

  function startWatch(token) {
    stopWatch();
    var geo = root.navigator && root.navigator.geolocation;
    if (!geo || !token || token !== session || token.mode !== 'geo') return;
    watchId = geo.watchPosition(function (pos) { onFix(token, pos); }, function (err) {
      if (!token || token !== session) return;
      if (err && err.code === 1) {
        clearSession();
        geoDenied = true;
        banner = '';
        paint();
      }
    }, { enableHighAccuracy: false, maximumAge: 10000, timeout: 20000 });
  }

  function probePosition() {
    return new Promise(function (resolve) {
      var geo = root.navigator && root.navigator.geolocation;
      if (!geo || typeof geo.getCurrentPosition !== 'function') {
        resolve({ ok: false, reason: 'unavailable' });
        return;
      }
      geo.getCurrentPosition(function (pos) { resolve({ ok: true, pos: pos }); }, function (err) {
        resolve({ ok: false, reason: err && err.code === 1 ? 'denied' : 'unavailable' });
      }, { enableHighAccuracy: false, maximumAge: 0, timeout: 12000 });
    });
  }

  function ensureNotify() {
    if (typeof root.Notification !== 'function') {
      var guide = root.HeuiArrive && root.HeuiArrive.missingNotification && root.HeuiArrive.missingNotification();
      if (guide && guide.type === 'sheet') return Promise.resolve({ ok: false, message: HOME_NOTE });
      return Promise.resolve({ ok: false, message: UNSUPPORTED_NOTE });
    }
    if (root.Notification.permission === 'denied') return Promise.resolve({ ok: false, message: DENIED_NOTE });
    if (root.Notification.permission === 'granted') return Promise.resolve({ ok: true });
    return new Promise(function (resolve) {
      var settled = false;
      function done(permission) {
        if (settled) return;
        settled = true;
        resolve(permission === 'granted' ? { ok: true } : { ok: false, message: DENIED_NOTE });
      }
      try {
        var pending = root.Notification.requestPermission(done);
        if (pending && pending.then) pending.then(done).catch(function () { done('denied'); });
      } catch (e) { done('denied'); }
    });
  }

  function onArm() {
    if (busy || session || readOff(storage())) return;
    var stop = selectedStop();
    var ctx = currentContext();
    if (!stop) return;
    var mine = ++op;
    busy = true;
    banner = '';
    paint();
    ensureNotify().then(function (gate) {
      if (mine !== op) return;
      if (!gate.ok) {
        busy = false;
        banner = gate.message;
        paint();
        return;
      }
      return probePosition().then(function (probed) {
        if (mine !== op) return;
        busy = false;
        if (probed.reason === 'denied') {
          geoDenied = true;
          banner = '';
          paint();
          return;
        }
        if (probed.ok) {
          var coords = probed.pos.coords || {};
          var distance = haversine({ lat: coords.latitude, lng: coords.longitude }, stop);
          if (alreadyNear(distance, coords.accuracy)) {
            banner = ALREADY_NOTE;
            paint();
            return;
          }
        }
        var token = {
          mode: 'geo',
          dest: stop,
          route: ctx.route,
          armedAt: Date.now(),
          streak: 0,
          fired: false
        };
        session = token;
        banner = '';
        if (probed.ok) onFix(token, probed.pos);
        if (session === token && !token.fired) startWatch(token);
        paint();
      });
    });
  }

  function onMinutes(value) {
    var minutes = normalizeMinutes(value);
    var stop = selectedStop();
    var ctx = currentContext();
    if (!minutes || !stop || session || readOff(storage())) return;
    var mine = ++op;
    busy = true;
    paint();
    ensureNotify().then(function (gate) {
      if (mine !== op) return;
      busy = false;
      if (!gate.ok) {
        banner = gate.message;
        paint();
        return;
      }
      clearSession();
      var token = {
        mode: 'time',
        dest: stop,
        route: ctx.route,
        minutes: minutes,
        armedAt: Date.now(),
        streak: 0,
        fired: false
      };
      session = token;
      banner = '';
      timer = root.setTimeout(function () { fire(token); }, minutes * 60000);
      paint();
    });
  }

  function cancel() {
    op++;
    clearSession();
    banner = '';
    geoDenied = false;
    paint();
  }

  function useTime() {
    op++;
    clearSession();
    geoDenied = true;
    banner = '';
    paint();
  }

  function toggleDisabled() {
    var off = !readOff(storage());
    writeOff(storage(), off);
    if (off) {
      op++;
      clearSession();
      banner = '';
      geoDenied = false;
    }
    sync();
  }

  function onClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var el = target.closest('[data-alight-arm],[data-alight-cancel],[data-alight-stop],[data-alight-min],[data-alight-dir],[data-alight-disable],[data-alight-route],[data-alight-use-time],[data-alight-retry-geo]');
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    if (el.hasAttribute('data-alight-disable')) { toggleDisabled(); return; }
    if (el.hasAttribute('data-alight-cancel')) { cancel(); return; }
    if (el.hasAttribute('data-alight-use-time')) { useTime(); return; }
    if (el.hasAttribute('data-alight-retry-geo')) { geoDenied = false; banner = ''; onArm(); return; }
    if (el.hasAttribute('data-alight-stop')) {
      ui.selectedId = el.getAttribute('data-alight-stop') || '';
      ui.selectedType = el.getAttribute('data-alight-type') || '';
      banner = '';
      paint();
      return;
    }
    if (el.hasAttribute('data-alight-dir')) {
      ui.dirIndex = parseInt(el.getAttribute('data-alight-dir'), 10);
      ui.selectedId = '';
      banner = '';
      paint();
      return;
    }
    if (el.hasAttribute('data-alight-route')) {
      var ctx = currentContext();
      ui.routePick = el.getAttribute('data-alight-route') || '';
      ui.routePickStation = ctx.id;
      ui.selectedId = '';
      ui.dirIndex = null;
      banner = '';
      sync();
      return;
    }
    if (el.hasAttribute('data-alight-min')) { onMinutes(el.getAttribute('data-alight-min')); return; }
    if (el.hasAttribute('data-alight-arm')) onArm();
  }

  var queued = false;
  function queue() {
    if (queued || painting) return;
    queued = true;
    var raf = root.requestAnimationFrame || function (fn) { return root.setTimeout(fn, 16); };
    raf(function () {
      queued = false;
      try { sync(); } catch (e) {}
    });
  }

  function setStops(stops) {
    rawStops = Array.isArray(stops) ? stops : [];
    index = indexStops(rawStops);
    seqCache = new Map();
    sync();
  }

  function start() {
    if (started || !doc()) return;
    started = true;
    doc().addEventListener('click', onClick, true);
    root.addEventListener('hashchange', queue);
    root.addEventListener('pageshow', function () {
      if (session && session.mode === 'geo' && watchId == null) startWatch(session);
    });
    var app = doc().getElementById('app');
    if (app && root.MutationObserver) new root.MutationObserver(queue).observe(app, { childList: true, subtree: true });
    if (root.__heuiRawStops) setStops(root.__heuiRawStops);
    else queue();
  }

  api.setStops = setStops;
  api.sync = sync;
  api.cancel = cancel;
  api.start = start;

  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else {
    root.HeuiAlight = api;
    api.start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
