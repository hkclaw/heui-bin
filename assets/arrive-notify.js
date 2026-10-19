/* Home-screen install guide for 去邊.
   Lead time for the station reminder: tap-eta-lead-min-v1 (3, 5, 8, or 10).
   Dismissals: tap-eta-install-entry-dismissed-v1, tap-eta-install-sheet-dismissed-v1. */
(function (root) {
  'use strict';

  var LEADS = [3, 5, 8, 10];
  var LEAD_KEY = 'tap-eta-lead-min-v1';
  var ENTRY_KEY = 'tap-eta-install-entry-dismissed-v1';
  var SHEET_KEY = 'tap-eta-install-sheet-dismissed-v1';
  var HOME_SCREEN_MESSAGE = '要由主畫面嘅「去邊」圖示開啟，先收到到站通知。';
  var UNSUPPORTED_MESSAGE = '呢部機唔支援通知。';
  var DENIED_MESSAGE = '通知未開。去系統設定允許「去邊」通知，再撳一次。';

  function normalizeLead(value) {
    var n = parseInt(value, 10);
    for (var i = 0; i < LEADS.length; i++) if (LEADS[i] === n) return n;
    return 5;
  }

  function buttonLabel(minutes) {
    return normalizeLead(minutes) + '分鐘前提醒';
  }

  function readStored(storage, key) {
    try { return storage.getItem(key); } catch (e) { return null; }
  }

  function writeStored(storage, key, value) {
    try { storage.setItem(key, value); } catch (e) {}
  }

  function readLead(storage) {
    return normalizeLead(readStored(storage, LEAD_KEY));
  }

  function writeLead(storage, minutes) {
    var lead = normalizeLead(minutes);
    writeStored(storage, LEAD_KEY, String(lead));
    return lead;
  }

  function readEntryDismissed(storage) {
    return readStored(storage, ENTRY_KEY) === '1';
  }

  function dismissEntry(storage) {
    writeStored(storage, ENTRY_KEY, '1');
  }

  function dismissSheet(storage) {
    writeStored(storage, SHEET_KEY, '1');
  }

  function detectInstall(env) {
    env = env || {};
    var ua = String(env.ua || '');
    var iphone = /iPad|iPhone|iPod/.test(ua);
    /* iPadOS reports as a Mac. A touchscreen Mac still has Notification,
       so that signal keeps the desktop install steps. */
    var ipadOs = env.platform === 'MacIntel' && (env.maxTouchPoints || 0) > 1 && !env.notification && !iphone;
    var ios = iphone || ipadOs;
    var android = /Android/i.test(ua);
    var mode = env.displayMode || '';
    var standalone = !!(
      env.standalone ||
      env.androidAppReferrer ||
      mode === 'standalone' ||
      mode === 'fullscreen' ||
      mode === 'minimal-ui' ||
      mode === 'window-controls-overlay'
    );
    return {
      ios: ios,
      android: android,
      standalone: standalone,
      hasNotification: !!env.notification,
      beforeInstall: !!env.beforeInstall
    };
  }

  function onRemindTap(env, state) {
    state = state || {};
    var detected = detectInstall(env);
    if (!detected.hasNotification) {
      if (!detected.standalone && (detected.ios || detected.android)) {
        return { type: 'sheet', message: HOME_SCREEN_MESSAGE };
      }
      return { type: 'unsupported', message: UNSUPPORTED_MESSAGE };
    }
    if (state.permission === 'denied') return { type: 'denied', message: DENIED_MESSAGE };
    if (state.permission === 'granted') return { type: 'enable' };
    return { type: 'ask' };
  }

  function sheetCopy(env) {
    env = env || {};
    var detected = detectInstall(env);
    var ua = String(env.ua || '');
    if (detected.ios) {
      var safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
      return {
        title: '加到主畫面',
        steps: ['撳「分享」', '揀「加入主畫面」', '用圖示開啟'],
        note: safari
          ? '用主畫面嘅「去邊」圖示開啟，先可以收到到站通知。'
          : '請用 Safari 開呢頁，再跟上面做。用圖示開啟先收到通知。',
        canPrompt: false
      };
    }
    if (detected.android) {
      return {
        title: '加到主畫面',
        steps: ['撳選單（⋮）', '揀「安裝應用程式」或「加到主畫面」', '用圖示開啟'],
        note: '用圖示開啟「去邊」，通知會穩陣啲。',
        canPrompt: !!env.beforeInstall
      };
    }
    return {
      title: '加到主畫面',
      steps: ['喺瀏覽器選單揀「安裝應用程式」或「加到主畫面」', '用圖示開啟'],
      note: '用圖示開啟之後，就可以好似一個 app 咁用。',
      canPrompt: !!env.beforeInstall
    };
  }

  function shouldAutoShow() {
    return false;
  }

  function entryVisible(env, entryDismissed) {
    return !detectInstall(env).standalone && !entryDismissed;
  }

  var api = {
    LEADS: LEADS,
    LEAD_KEY: LEAD_KEY,
    ENTRY_KEY: ENTRY_KEY,
    SHEET_KEY: SHEET_KEY,
    HOME_SCREEN_MESSAGE: HOME_SCREEN_MESSAGE,
    UNSUPPORTED_MESSAGE: UNSUPPORTED_MESSAGE,
    DENIED_MESSAGE: DENIED_MESSAGE,
    normalizeLead: normalizeLead,
    buttonLabel: buttonLabel,
    readLead: readLead,
    writeLead: writeLead,
    readEntryDismissed: readEntryDismissed,
    dismissEntry: dismissEntry,
    dismissSheet: dismissSheet,
    detectInstall: detectInstall,
    onRemindTap: onRemindTap,
    sheetCopy: sheetCopy,
    shouldAutoShow: shouldAutoShow,
    entryVisible: entryVisible,
    missingNotification: missingNotification,
    start: start
  };

  var started = false;
  var deferred = null;
  var sheetEl = null;
  var lastTrigger = null;

  function ls() { return root.localStorage; }

  function displayMode() {
    var modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
    for (var i = 0; i < modes.length; i++) {
      try {
        if (root.matchMedia && root.matchMedia('(display-mode: ' + modes[i] + ')').matches) return modes[i];
      } catch (e) {}
    }
    return 'browser';
  }

  function currentEnv() {
    var nav = root.navigator || {};
    return {
      ua: nav.userAgent || '',
      platform: nav.platform || '',
      maxTouchPoints: nav.maxTouchPoints || 0,
      standalone: nav.standalone === true,
      displayMode: displayMode(),
      androidAppReferrer: String((root.document && root.document.referrer) || '').indexOf('android-app://') === 0,
      notification: typeof root.Notification !== 'undefined',
      beforeInstall: !!deferred
    };
  }

  function ensureSheet() {
    if (sheetEl || !root.document || !root.document.body) return;
    sheetEl = root.document.createElement('div');
    sheetEl.className = 'install-sheet';
    sheetEl.hidden = true;
    sheetEl.innerHTML =
      '<div class="install-card" role="dialog" aria-modal="false" aria-labelledby="install-sheet-title">' +
        '<button type="button" class="install-sheet-x" data-install-close aria-label="關閉">×</button>' +
        '<p class="install-kicker">去邊</p>' +
        '<h2 id="install-sheet-title">加到主畫面</h2>' +
        '<ol class="install-steps" data-install-steps></ol>' +
        '<p class="install-note" data-install-note></p>' +
        '<button type="button" class="btn btn-primary" data-install-prompt hidden>安裝應用程式</button>' +
        '<button type="button" class="btn btn-ghost install-done" data-install-close>知道</button>' +
      '</div>';
    root.document.body.appendChild(sheetEl);
    sheetEl.addEventListener('click', function (event) {
      if (event.target.closest('[data-install-close]')) {
        event.preventDefault();
        closeSheet();
        return;
      }
      if (event.target.closest('[data-install-prompt]')) {
        event.preventDefault();
        if (!deferred) return;
        var prompt = deferred;
        deferred = null;
        prompt.prompt();
        if (prompt.userChoice) prompt.userChoice.then(function () {}).catch(function () {});
      }
    });
  }

  function fillSheet() {
    if (!sheetEl) return;
    var copy = sheetCopy(currentEnv());
    sheetEl.querySelector('#install-sheet-title').textContent = copy.title;
    var list = sheetEl.querySelector('[data-install-steps]');
    list.textContent = '';
    copy.steps.forEach(function (step, index) {
      var li = root.document.createElement('li');
      var num = root.document.createElement('span');
      num.className = 'install-step-no';
      num.textContent = String(index + 1);
      var label = root.document.createElement('span');
      label.textContent = step;
      li.appendChild(num);
      li.appendChild(label);
      list.appendChild(li);
    });
    sheetEl.querySelector('[data-install-note]').textContent = copy.note;
    sheetEl.querySelector('[data-install-prompt]').hidden = !copy.canPrompt;
  }

  function openSheet(trigger) {
    ensureSheet();
    if (!sheetEl) return;
    fillSheet();
    lastTrigger = trigger || null;
    sheetEl.hidden = false;
    var close = sheetEl.querySelector('.install-sheet-x');
    if (close && close.focus) close.focus();
  }

  function closeSheet() {
    if (!sheetEl || sheetEl.hidden) return;
    sheetEl.hidden = true;
    dismissSheet(ls());
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    lastTrigger = null;
  }

  function missingNotification() {
    var result = onRemindTap(currentEnv(), { on: false, permission: 'missing' });
    if (result.type === 'sheet') openSheet();
    return result;
  }

  function entryHtml() {
    return (
      '<p class="arrive-install-row">' +
        '<button type="button" class="arrive-install" data-arrive-install>加到主畫面</button>' +
        '<button type="button" class="arrive-install-x" data-arrive-dismiss-entry aria-label="唔使顯示加到主畫面">×</button>' +
      '</p>'
    );
  }

  function syncEntry() {
    var doc = root.document;
    if (!doc) return;
    var app = doc.getElementById('app');
    if (!app) return;
    var home = app.querySelector('#nearby-slot');
    var row = app.querySelector('.arrive-install-row');
    if (!home) return;
    var main = app.querySelector('.main');
    if (!main) return;
    if (!row) {
      main.insertAdjacentHTML('afterbegin', entryHtml());
      row = main.querySelector('.arrive-install-row');
    }
    row.hidden = !entryVisible(currentEnv(), readEntryDismissed(ls()));
  }

  function syncNote() {
    var note = root.document && root.document.getElementById('eta-arm-note');
    if (!note) return;
    var guide = note.textContent === HOME_SCREEN_MESSAGE;
    if (guide) {
      note.setAttribute('data-arrive-install', '');
      note.setAttribute('role', 'button');
      if (!note.getAttribute('tabindex')) note.setAttribute('tabindex', '0');
    } else if (note.hasAttribute('data-arrive-install')) {
      note.removeAttribute('data-arrive-install');
      note.removeAttribute('role');
      note.removeAttribute('tabindex');
    }
  }

  function onClick(event) {
    var dismissBtn = event.target.closest && event.target.closest('[data-arrive-dismiss-entry]');
    var installBtn = event.target.closest && event.target.closest('[data-arrive-install]');
    if (!dismissBtn && !installBtn) return;
    if (event.target.closest && event.target.closest('.install-sheet')) return;
    event.preventDefault();
    event.stopPropagation();
    if (dismissBtn) {
      dismissEntry(ls());
      syncEntry();
      return;
    }
    openSheet(installBtn);
  }

  function onPointer(event) {
    if (!sheetEl || sheetEl.hidden) return;
    if (sheetEl.contains(event.target)) return;
    if (event.target.closest && event.target.closest('[data-arrive-install]')) return;
    closeSheet();
  }

  function onKey(event) {
    if (event.key === 'Escape') closeSheet();
    if ((event.key === 'Enter' || event.key === ' ') && event.target && event.target.id === 'eta-arm-note' && event.target.hasAttribute('data-arrive-install')) {
      event.preventDefault();
      openSheet(event.target);
    }
  }

  var queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    var raf = root.requestAnimationFrame || function (fn) { return root.setTimeout(fn, 16); };
    raf(function () {
      queued = false;
      try {
        syncEntry();
        syncNote();
      } catch (e) {}
    });
  }

  function start() {
    if (started || !root.document) return;
    started = true;
    ensureSheet();
    var app = root.document.getElementById('app');
    if (app && root.MutationObserver) {
      new root.MutationObserver(queue).observe(app, { childList: true, subtree: true, characterData: true });
    }
    root.addEventListener('hashchange', queue);
    root.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferred = event;
      queue();
    });
    root.addEventListener('appinstalled', function () {
      deferred = null;
      queue();
    });
    root.document.addEventListener('click', onClick);
    root.document.addEventListener('keydown', onKey);
    root.document.addEventListener('pointerdown', onPointer, true);
    queue();
  }

  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else {
    root.HeuiArrive = api;
    api.start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
