if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js?rev=v20261029a', { scope: '/' }).then(function (reg) {
    function showBanner(worker) {
      try {
        if (document.getElementById('sw-update-banner')) return;
        if (!worker || worker.state !== 'installed') return;
        var current = navigator.serviceWorker.controller;
        if (!current || current === worker) return;
        var b = document.createElement('button');
        b.id = 'sw-update-banner'; b.className = 'sw-update'; b.type = 'button';
        b.setAttribute('aria-label', '有新版本，更新');
        b.innerHTML = '<span class="sw-dot" aria-hidden="true"></span><span>有新版本 · 更新</span>';
        function label() { return b.querySelector('span:last-child'); }
        function clearUpdating() {
          if (window.__swUpdateTimer) {
            clearTimeout(window.__swUpdateTimer);
            window.__swUpdateTimer = 0;
          }
          b.disabled = false;
          b.removeAttribute('aria-busy');
          delete b.dataset.busy;
          var span = label();
          if (span) span.textContent = '有新版本 · 更新';
        }
        function finish() {
          if (window.__swReloading) return;
          window.__swReloading = true;
          location.reload();
        }
        worker.addEventListener('statechange', function () {
          if (worker.state === 'activated') finish();
          else if (worker.state === 'redundant' && b.isConnected) b.remove();
        });
        b.addEventListener('click', function () {
          if (worker.state === 'activated') { finish(); return; }
          if (worker.state === 'redundant') { b.remove(); return; }
          b.disabled = true;
          b.dataset.busy = '1';
          b.setAttribute('aria-busy', 'true');
          var span = label();
          if (span) span.textContent = '更新緊…';
          try {
            worker.postMessage({ type: 'SKIP_WAITING' });
          } catch (e) {
            clearUpdating();
            return;
          }
          var started = Date.now();
          (function tick() {
            if (!b.isConnected || window.__swReloading) return;
            if (worker.state === 'activated') { finish(); return; }
            if (worker.state === 'redundant') { b.remove(); return; }
            var waited = Date.now() - started;
            if ((worker.state === 'installed' && waited > 8000) || waited > 20000) {
              clearUpdating();
              return;
            }
            window.__swUpdateTimer = setTimeout(tick, 300);
          })();
        });
        (document.body || document.documentElement).appendChild(b);
      } catch (_) {}
    }
    function onInstalled() { if (reg.waiting) showBanner(reg.waiting); }
    if (reg.waiting && reg.waiting.state === 'installed') showBanner(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var ni = reg.installing;
      if (ni) ni.addEventListener('statechange', onInstalled);
    });
    reg.update();
  }).catch(function () {});
}
