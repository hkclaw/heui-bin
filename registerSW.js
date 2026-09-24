if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js?rev=v20260827q', { scope: '/' }).then(function (reg) {
    function showBanner(worker) {
      try {
        if (document.getElementById('sw-update-banner')) return;
        var b = document.createElement('button');
        b.id = 'sw-update-banner'; b.className = 'sw-update'; b.type = 'button';
        b.setAttribute('aria-label', '有新版本，更新');
        b.innerHTML = '<span class="sw-dot" aria-hidden="true"></span><span>有新版本 · 更新</span>';
        b.addEventListener('click', function () {
          b.disabled = true;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'activated') location.reload();
          });
          worker.postMessage({ type: 'SKIP_WAITING' });
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