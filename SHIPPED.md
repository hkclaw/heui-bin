# SHIPPED — v20260827q (2026-09-24)

去邊 PWA — surgical patch over live snapshot `v20260827p`.

## What changed

### 1. PWA update UX (was broken)
- New SW previously called `self.skipWaiting()` unconditionally, so an updated SW activated silently and the page kept serving the old bundle until the user manually reloaded. There was no in-page indication that an update was waiting.
- Removed unconditional `self.skipWaiting()` from `sw.js`. `clientsClaim()` kept (so the SW takes control the moment the user confirms).
- Added `self.addEventListener('message', …)` in `sw.js` that calls `skipWaiting()` only when the page posts `{type:'SKIP_WAITING'}`.
- Inline SW registration in `index.html` (and `registerSW.js`, which was an orphan file but referenced by `_headers`) now:
  - listens for `updatefound` and `statechange` events on the registration,
  - renders a small Cantonese pill banner「有新版本 · 更新」above the mode bar when a worker is waiting,
  - on tap, posts `SKIP_WAITING` to the waiting worker and reloads once it becomes `activated`.
- A `controllerchange` listener reloads the page once after the new SW takes control, guarded by a flag to avoid reload loops. Only reloads if there *was* an existing controller (i.e. a real SW swap) — first-ever install never triggers a useless reload.

### 2. Share button (new)
- Added a `↗` icon button to the topbar (replaces the empty `icon-spacer` on pages that don't render explicit `actions`). Uses the existing `.icon-btn` style; styled in `styles.css` and the new `assets/index-v20260827q.css`.
- Click handler in the minified bundle calls `navigator.share({title:'去邊', text:'開頁就見到下一架', url: location.origin + '/'})`. Falls back to `navigator.clipboard.writeText(…)` then `alert('已複製連結')` when Web Share isn't available or the user cancels.

### 3. Layout flash audit
- The only `location.reload()` call in the production bundle is the manual user-initiated `[data-action="reload"]` button in the footer — that's a deliberate refresh action, not a layout-flash culprit, and was left intact. GPS/PWA update reloads remain unaffected (they use the new SW-update flow above).

### 4. Asset / cache rev bump
- `rev.txt` `v20260827p` → `v20260827q`.
- `index.html` `<meta name="tap-eta-rev">` and inline `REV` constant both `p` → `q`.
- `assets/index-v20260827q.js` and `.css` are new files (copies of `p` with the surgical share/banner edits above and a fresh sha256 revision in the SW precache).
- All Workbox cache names (`heui-bin-{prefix,static,icons,catalogues,kmb-eta,mtr-eta}-v20260827p`) bumped to `q` so old caches are dropped on next activate.
- `sw.js` precache entry for the JS asset re-hashed (sha256 of the new bundle).

## Files modified

| File | Change |
| --- | --- |
| `index.html` | rev meta + inline `REV`; new SW waiting-listener + update banner; new asset refs |
| `sw.js` | removed `self.skipWaiting()`; added `message` handler; cache prefix `p→q`; JS asset re-hashed |
| `registerSW.js` | rev `p→q`; added the same update-banner handler for completeness |
| `assets/index-v20260827q.js` | NEW — copy of `p` + share-button click handler + template injection |
| `assets/index-v20260827q.css` | NEW — copy of `p` + `.sw-update` and `.icon-btn[data-action="share-app"]` rules |
| `styles.css` | same `.sw-update` / share rules appended (so first paint has them even before the per-rev CSS lands) |
| `rev.txt` | `v20260827p` → `v20260827q` |
| `SHIPPED.md` | this note |

Untouched: `assets/eta-details.css`, `assets/index-v20260827{c,d,f,g,h,j,k,l,m,n,o,p}.*` (orphaned from prior deploys — not referenced by `index.html` anymore; left in place per minimal-surgical rule).

## Deploy

- **Not deployed.** No `surge` CLI or credentials available in this environment (`which surge`, `~/.surge`, `SURGE_*` all empty). Status: **NEED_SURGE_AUTH**.
- Deploy with: `surge --project ./ --domain tap-eta-hk.surge.sh` from this folder, then verify with `curl -sI https://tap-eta-hk.surge.sh/rev.txt` and `curl -sI https://tap-eta-hk.surge.sh/sw.js` — both should return `200` with `Cache-Control: no-store` per `_headers`.

## Risks / notes for the next operator

- **Stale SW on existing clients**: the very first load after deploy will see the new `index.html` (NetworkOnly navigation), register a new SW, and the new SW will install alongside the old one. The old SW stays in control until the user reloads at least once (or closes the tab). That reload surfaces the new「有新版本 · 更新」banner — make sure to test on a real device before announcing.
- **Reload guard**: the `controllerchange` reload is guarded by `window.__swReloading`; if a future code path introduces another `controllerchange` listener that also reloads, we could see double reloads. Single guard today, easy to extend if needed.
- **Share fallback**: `alert('已複製連結')` is plain. A future rev could replace it with the app's existing toast (`H().toast?.(…)`) — I deliberately avoided poking the app's internal toast API from the bundle since the click handler lives in the existing minified `Jt` function and a wrong symbol would crash the whole click delegate.
- **Orphaned asset files** (`assets/index-v20260827{c,d,f,g,h,j,k,l,m,n,o,p}.*`) ship on every deploy because `.surgeignore` only excludes `README.md`. They cost ~1.7 MB of repeated upload. Consider adding `assets/index-v*.{js,css}` to `.surgeignore` next time someone touches the deployment story — not done in this rev to keep the patch surgical.
- **`registerSW.js`** is now self-consistent but still orphan (not referenced by `index.html`). Kept around because `_headers` mentions it; if you decide to drop it, also remove the corresponding `_headers` line.