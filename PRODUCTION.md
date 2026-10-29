# 去邊 production setup

Checked 2026-10-18 against this repository and the live hosts. This file is the runbook.

The snapshot in this repository is `v20261029b`. The measurements below are the 2026-10-18 check and stay as that day's record.

As of 2026-10-18 13:01 UTC, `https://heuibin.codecoffee.online/rev.txt` and `https://tap-eta-hk.surge.sh/rev.txt` both return `v20260827q`. The custom-hostname certificate is `CN=heuibin.codecoffee.online`, notAfter 16 January 2027. Plain `http://heuibin.codecoffee.online/rev.txt` still returns 200, so `--force https` has not been applied. Pushes to `main` publish through `.github/workflows/ci.yml` after the `SURGE_TOKEN` repository secret exists.

Brand spelling is `heuibin`. The share name is 去邊.

## Buy nothing for hosting

The phone is the runtime. The repository has no `package.json`, no Dockerfile, and no server. Production is Surge’s free static hosting plus Surge’s free managed certificate.

Spend $0 and finish HTTPS on `heuibin.codecoffee.online`. Public DNS already shows that Namecheap zone pointed at Surge. Buy a domain only when you want a standalone brand and you do not already control `codecoffee.online`.

Do not buy a VM, a Node host, Fly, Railway, Render, Surge Professional, or a Cloudflare plan. Node is required only on the computer that runs the Surge CLI.

Surge Professional is listed at $30/month on <https://surge.sh/pricing>. The current platform plan page, <https://surge.sh/docs/platform/plans>, limits the paid features to password protection (`AUTH`), redirects (`ROUTER`), CORS, and uploading your own PEM. This PWA uses none of those. The marketing price page still lists “Force http to https” on the $30 plan. The platform SSL page, <https://surge.sh/docs/platform/ssl>, documents `surge ./ heuibin.codecoffee.online --force https` as a sticky publish flag and limits the paid certificate feature to `surge example.com ssl --pem`. If the CLI asks for a card only because of `--force https`, stop and do not pay. A valid managed certificate is what the installed PWA needs. Visitors can open the `https://` URL without an HTTP redirect.

### Optional domain, only for a new brand

Public prices fetched 2026-10-18:

| Name | Price | Source |
| --- | --- | --- |
| `.com` at Namecheap, first year on the page | USD 11.28 (list price shown beside it: USD 14.98). New-customer first year USD 6.48, one domain per household. Renewal USD 18.48/year. | <https://www.namecheap.com/domains/registration/gtld/com/> |
| ICANN fee added at Namecheap checkout | USD 0.20 per year | <https://www.namecheap.com/support/knowledgebase/article.aspx/1256/2201/what-is-the-icann-fee/> |
| Namecheap regular `.com` price from 1 November 2026 | Registration and transfer USD 15.98/year. Renewal USD 19.98/year. Both exclude the ICANN fee. Page updated 15 October 2026. | <https://www.namecheap.com/support/knowledgebase/article.aspx/10840/2201/com-price-change-november-1-2026/> |
| Second-level `.hk` / `.香港` at HKDNR, one-year Chinese-English bundle | HK$250. Two years HK$500, three years HK$625, five years HK$1000. | <https://www.hkdnr.hk/en/change/feeschedule/table-for-application-fee/> and <https://www.hkdnr.hk/en/faq/registerfaq/second-level-hk-domain-name/> |
| `.com.hk` one-year bundle at HKDNR | HK$200 | Same HKDNR fee table |

Register the label as `heuibin` (for example `heuibin.com` or `heuibin.hk`). After it exists, repeat the custom-domain steps below with that hostname. Until then, stay on `heuibin.codecoffee.online`.

## What this app is

Static PWA snapshot. The browser runs it.

| Concern | Where it lives |
| --- | --- |
| Shell | `index.html`. Local meta `tap-eta-rev` and inline `REV` are `v20260827q`. The module is `/assets/index-v20260827q.js`. |
| Revision stamp | `rev.txt` is `v20260827q`. |
| Service worker | `sw.js` (Workbox 7.4.0). Cache prefix `heui-bin-v20260827q`. `skipWaiting()` runs only after the page posts `{type:'SKIP_WAITING'}`. |
| Precache | Icons, `assets/index-v20260827q.js`, `assets/index-v20260827q.css`, `assets/eta-details.css`, `data/*.json` (3,193,506 bytes, about 3.1 MB), `manifest.webmanifest`. `index.html` is not precached. |
| Routing | `hashchange` in `assets/index-v20260827q.js`. The bundle contains no `pushState`. No `200.html` and no `ROUTER` file. |
| Favorites | `localStorage` key `tap-eta-favorites-v1`. The minified binding is `Ge`. Also `Ke` = `tap-eta-mode-filter-v1`, `Je` = `tap-eta-recent-search-v1`, `qe` = `tap-eta-entrance-v1`. |
| Geolocation | `navigator.geolocation.getCurrentPosition` in the same bundle. |
| KMB ETA | `https://data.etabus.gov.hk/v1/transport/kmb/stop` and `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${id}` |
| MTR ETA | `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${line}&sta=${sta}` |
| Light rail ETA | `https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=${id}&with_special=1` |
| Map tiles | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| Fonts | `fonts.googleapis.com` and `fonts.gstatic.com` from `index.html` (Noto Sans TC). |

The service worker, install, and geolocation need a secure context. `http://heuibin.codecoffee.online` can show the page. It is not the production PWA URL.

`sw.js` routes in the local `q` file:

- `NetworkOnly` for navigations, `/index.html`, `/rev.txt`, `/sw.js`, `/registerSW.js`, and `*.webmanifest`.
- `NetworkFirst` for `.js` and `.css`: cache `heui-bin-static-v20260827q`, timeout 4s, 48 entries, max age 86400s.
- `StaleWhileRevalidate` for png/ico/svg: cache `heui-bin-icons-v20260827q`, 24 entries, max age 2592000s.
- `NetworkFirst` for `/data/*.json`: cache `heui-bin-catalogues-v20260827q`, timeout 8s, 8 entries, max age 43200s.
- `NetworkFirst` for `https://data.etabus.gov.hk/*` and `https://rt.data.gov.hk/*`: 64 entries, max age 60s, timeout 8s.

The live hosts are still the previous worker (`v20260827p`), which calls `skipWaiting()` itself and has no `SKIP_WAITING` listener.

## What is live (2026-10-18)

Two different Surge publishes serve the same `v20260827p` bytes. A third, older publish is on the apex. Publishing one hostname does not update the others.

| URL | Result on 2026-10-18 |
| --- | --- |
| `https://tap-eta-hk.surge.sh/rev.txt` | HTTP 200, body `v20260827p`. `cache-control: public, max-age=0, must-revalidate`. Example stamp `2920239::1787823819012-6c71dde5181ab07be9e4c2ea7b721ce0`. |
| `https://tap-eta-hk.surge.sh/` | References `index-v20260827p.js` and `REV = 'v20260827p'`. |
| `http://heuibin.codecoffee.online/rev.txt` | HTTP 200, body `v20260827p`, same rev.txt hash, different revision token. Example stamp `2576592::1787887462585-6c71dde5181ab07be9e4c2ea7b721ce0`. |
| `https://heuibin.codecoffee.online/rev.txt` | TLS failure. Certificate `CN=*.surge.sh`, SAN `DNS:*.surge.sh, DNS:surge.sh`, issuer Sectigo, notBefore 1 June 2026, notAfter 16 December 2026. No name for `heuibin.codecoffee.online`. |
| `http://codecoffee.online/rev.txt` | HTTP 200, body `v20260827m`. Example stamp `1614545::1787814054965-caf1c95fda66d0a68a9ab6778811188e`. Leave this project alone during this setup. |
| `http://www.codecoffee.online/rev.txt` | HTTP 301 to `http://codecoffee.online/rev.txt`. |

`/_headers` on both `tap-eta-hk.surge.sh` and `heuibin.codecoffee.online` is byte-for-byte this repo’s file (`sha256 584d4a421e5481a87b3838402f95a48be83d34790987ea31f423d2479cd69ffe`) and the responses above are still `max-age=0, must-revalidate`, not `no-store`. Surge is storing that file. It is not applying it. See “Cache-header invariants”.

`CNAME` in the repo contains `tap-eta-hk.surge.sh`. A bare `surge` / `surge publish` follows that file and updates only the `surge.sh` project. Always pass the hostname.

`.surgeignore` used to list `rev.txt`. That line is removed in this guide’s commit. A publish with `rev.txt` ignored would omit the stamp the checks below require. `PRODUCTION.md` and `PROGRESS.md` are ignored so the next publish does not start serving this runbook. Old bundles `assets/index-v20260827c.*` through `p.*` stay ignored. `q` is not ignored.

## Why Cloudflare Flexible is the wrong fix

`PROGRESS.md` (2026-09-24) said to stay on Surge and finish the lock icon with a Cloudflare proxy, on the belief that Surge would charge for the certificate. That belief is stale. <https://surge.sh/docs/platform/custom-domains> and <https://surge.sh/docs/platform/ssl> say custom domains and managed certificates are free. After DNS points at Surge the hostname moves `waiting on dns` → `securing` → `live`.

The failure measured above is narrower than “Surge cannot do HTTPS”. HTTP already reaches a Surge project. The TLS handshake still offers the `*.surge.sh` certificate. The missing piece is a certificate whose SAN includes `heuibin.codecoffee.online`, which is the `securing` → `live` step. Check it with `surge heuibin.codecoffee.online debug status`.

Flexible SSL would put Cloudflare’s certificate in front and connect to Surge over HTTP. That papers over the missing name. It also blocks the fix:

- The zone’s name servers are `dns1.registrar-servers.com` and `dns2.registrar-servers.com`. Mail is here: MX `eforward1` through `eforward5.registrar-servers.com`, and TXT `v=spf1 include:spf.efwd.registrar-servers.com ~all`. Proxying or moving the name servers to issue a temporary certificate takes the hostname off Surge. Surge issues its own certificate only when the name resolves to Surge.
- `--force https` on Surge answers HTTP with a redirect to HTTPS. Flexible talks to the origin on HTTP. Those two redirects loop.
- The service worker is registered from `/sw.js?rev=`. A second cache in front of Surge can hold an old worker after a publish. ETA freshness is already capped at 60 seconds inside `sw.js`. A proxy does not sit on the phone’s calls to `data.etabus.gov.hk`, `rt.data.gov.hk`, OpenStreetMap, or Google Fonts.
- Cloudflare Pages is also $0 and can issue a custom-domain certificate. This project is already on Surge, DNS already points at Surge, and `_headers` is the Surge-shaped note in the repo. Moving hosts does not publish `v20260827q` and is not required to get a certificate.

Do not change the Namecheap name servers to `ns1.surge.world`–`ns4.surge.world`. Surge’s own docs recommend that only when the whole zone can move. This zone has mail forwarding.

## DNS records to keep

Checked with `dig` on 2026-10-18. Change nothing for the default path.

| Record | Keep |
| --- | --- |
| `codecoffee.online` NS | `dns1.registrar-servers.com`, `dns2.registrar-servers.com` |
| `codecoffee.online` A | `138.197.235.123` (Surge’s documented single-region A record). This is the apex project on `v20260827m`, not the heuibin project. |
| `codecoffee.online` MX and SPF TXT | The Namecheap forwarders above. |
| `heuibin.codecoffee.online` CNAME | `geo.surge.sh`, which currently resolves to `159.203.50.177`. |
| `www.codecoffee.online` CNAME | `geo.surge.sh`. It 301s to the apex. Leave it. |

`geo.surge.world` is the target printed in the current custom-domain doc, and `geo.surge.sh` is documented as still valid. On 2026-10-18 both names resolved to `159.203.50.177`. Do not add an A record next to the CNAME. If `surge heuibin.codecoffee.online debug status` prints `waiting on dns` even though this CNAME is in place, change only that CNAME’s target to `geo.surge.world` and check again.

Surge redirects `www` and the apex to each other when both reach Surge. Publishing `heuibin` does not replace the apex snapshot.

## One-time setup

Run this on a machine where you can log in to the Surge account that owns these projects. From the repository root, on the commit that contains `v20260827q`.

### 1. Install the CLI and log in

```sh
npm install --global surge
surge login
surge whoami
```

Success: `surge whoami` prints the account email. The token stays in `~/.surge` on that machine. Do not commit it and do not paste it into the repo.

### 2. Confirm the tree that will upload

```sh
test "$(cat rev.txt)" = "v20260827q"
test -f assets/index-v20260827q.js
test -f assets/index-v20260827q.css
grep -q 'index-v20260827q.js' index.html
if grep -qx 'rev.txt' .surgeignore; then
  echo "STOP: rev.txt is ignored and will not upload"
  exit 1
fi
echo "tree ok"
```

Success: the script prints `tree ok`.

### 3. Publish both projects

`tap-eta-hk.surge.sh` and `heuibin.codecoffee.online` are separate publishes (different surge-stamp revision tokens above). Do both.

Leave `--force https` off this first custom-domain publish. HTTPS on that name currently fails the TLS handshake. Forcing the redirect now would send the working `http://` URL to a certificate browsers reject.

```sh
surge ./ tap-eta-hk.surge.sh
surge ./ heuibin.codecoffee.online
```

Success for each command: the CLI prints `Success!` and the hostname you passed. It may also print `securing` or `live` for the custom domain.

Publishing rewrites the local `CNAME` file to the hostname you just passed. After the two commands, put the repo file back unless you have decided the custom domain is the default:

```sh
git checkout -- CNAME
cat CNAME
```

Success: `CNAME` contains `tap-eta-hk.surge.sh`. Keep passing hostnames on the command line either way.

### 4. Confirm DNS, then the certificate

```sh
dig +short heuibin.codecoffee.online CNAME
dig +short heuibin.codecoffee.online A
surge heuibin.codecoffee.online debug status
```

Success:

- CNAME is `geo.surge.sh` or `geo.surge.world`.
- The A answer is a Surge edge address (on 2026-10-18, `159.203.50.177` via `geo.surge.sh`).
- Status moves to `securing` while Surge requests the certificate, then `live`.

`live` means Surge completed a real edge request with a valid certificate. Optional detail:

```sh
surge heuibin.codecoffee.online debug certs
surge heuibin.codecoffee.online debug audit
```

While status is `securing`, do not put another proxy in front, and do not buy a certificate. There is no `surge` command to upload a PEM on the free plan, and this app does not need one.

### 5. Stick the HTTPS redirect after the name matches

Run the openssl check first. Success is a subject or SAN that includes `heuibin.codecoffee.online`, and `curl` without `-k` returning 200.

```sh
echo | openssl s_client -connect heuibin.codecoffee.online:443 -servername heuibin.codecoffee.online 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
curl -fsS -D - -o /tmp/heui-rev.txt https://heuibin.codecoffee.online/rev.txt
cat /tmp/heui-rev.txt
```

Failure, which was still true on 2026-10-18 before this setup: `curl` exits 60, subject `CN=*.surge.sh`, SAN `DNS:*.surge.sh, DNS:surge.sh`.

When the openssl names include the hostname:

```sh
surge ./ heuibin.codecoffee.online --force https
git checkout -- CNAME
```

The platform docs say the flag sticks across later publishes, so later publishes of this hostname do not need the flag again. Confirm:

```sh
curl -sI http://heuibin.codecoffee.online/rev.txt | head -n 15
```

Success: `301` or `308` (or another redirect) whose `Location` is `https://heuibin.codecoffee.online/rev.txt`. If the CLI demands Surge Professional for this flag alone, skip the flag. The `https://` URL is already the production URL once step 4 is `live`.

### 6. Verify the published bytes

```sh
echo "tap $(curl -fsS https://tap-eta-hk.surge.sh/rev.txt)"
echo "heui $(curl -fsS https://heuibin.codecoffee.online/rev.txt)"
curl -fsS https://tap-eta-hk.surge.sh/ | grep -o 'index-v20260827[a-z].js'
curl -fsS https://heuibin.codecoffee.online/ | grep -o 'index-v20260827[a-z].js'
echo "--- cache ---"
for u in \
  https://tap-eta-hk.surge.sh/ \
  https://tap-eta-hk.surge.sh/rev.txt \
  https://tap-eta-hk.surge.sh/sw.js \
  https://tap-eta-hk.surge.sh/registerSW.js \
  https://tap-eta-hk.surge.sh/assets/index-v20260827q.js \
  https://heuibin.codecoffee.online/rev.txt \
  https://heuibin.codecoffee.online/sw.js
do
  printf '%s  ' "$u"
  curl -fsSI "$u" | awk 'BEGIN{IGNORECASE=1} /^HTTP|^cache-control:/{print}'
done
```

Success:

- Both `rev.txt` bodies are `v20260827q` with no extra characters other than a trailing newline.
- Both HTML documents reference `index-v20260827q.js`.
- Every listed URL returns HTTP 200.
- Each `cache-control` includes `no-store`, `no-cache`, or `max-age=0`. See the invariant section before calling a different value a failure.
- `https://heuibin.codecoffee.online` works without `-k`.

`http://codecoffee.online/rev.txt` staying on `v20260827m` is expected. That publish was not part of this setup.

### 7. Phone checks

Use a phone on cellular or a normal Wi-Fi network, not a desktop with `-k`.

1. Open `https://heuibin.codecoffee.online/`. The browser shows a lock and no certificate interstitial.
2. Add to Home Screen (Safari) or Install (Chrome). The manifest name is 去邊, `display` is `standalone`.
3. Open the installed icon. The address bar is gone. Move from the home list into a stop. The URL hash changes. Reloading that hash opens the same screen.
4. Favorite a stop. Force-quit the installed app and open it again. The favorite is still there. It is `localStorage` key `tap-eta-favorites-v1` on that origin. The `surge.sh` origin has its own empty list.
5. Confirm an ETA row updates from the phone’s own request to the KMB or MTR URL. Surge does not proxy those calls.
6. Deny location once and confirm the rest of the app still opens. Then allow location and confirm a nearby result can appear.
7. After a later rev is published, open the installed app, let the page load, and look for the button「有新版本 · 更新」. Tap it. The page reloads once into the new bundle. The first install on a phone does not show that button.

## CI/CD

`.github/workflows/ci.yml` follows the installed `setting-up-ci` skill, adapted to this repo. There is no `package.json`, so the check job runs `scripts/check-snapshot.sh` instead of `npm test`. The deploy job runs only on a push to `main`, after that check passes. It publishes `./` to `tap-eta-hk.surge.sh` and then to `heuibin.codecoffee.online`. The token is `secrets.SURGE_TOKEN`. It is not stored in the workflow.

On the machine that is already logged into the Surge account that owns both projects:

```sh
surge tokens add -m ci
gh secret set SURGE_TOKEN --repo hkclaw/heui-bin
```

Paste the token when `gh` asks. Do not commit it. `surge tokens add --domain heuibin.codecoffee.online` would not cover `tap-eta-hk.surge.sh`, so leave `--domain` off for this pipeline. After the secret exists, a push to `main` is the publish. The job fails closed if `SURGE_TOKEN` is empty, because an interactive `surge login` would hang the runner.

## Republish a new rev

Do this for every snapshot after `q`.

1. Copy the current JS and CSS to the next letter, for example `assets/index-v20260827r.js` and `.css`. Point `index.html` at them (`tap-eta-rev`, inline `REV`, script src, stylesheet href).
2. Set `rev.txt` to the same string, one line.
3. In `sw.js`, bump every `v20260827q` cache name to the new rev, precache the new JS/CSS hashes, and keep the `message` listener that calls `skipWaiting()` only for `{type:'SKIP_WAITING'}`.
4. Append the previous asset glob to `.surgeignore` (`assets/index-v20260827q.*`). Leave `rev.txt` unignored.
5. From the repo root:

```sh
test "$(cat rev.txt)" = "v20260827r"   # use the new rev
if grep -qx 'rev.txt' .surgeignore; then echo "STOP"; exit 1; fi
surge ./ tap-eta-hk.surge.sh
surge ./ heuibin.codecoffee.online
git checkout -- CNAME
```

6. Repeat the verify block in step 6 with the new letter.
7. On a phone that already installed the PWA, load once so the browser can see the new `sw.js?rev=`, then tap「有新版本 · 更新」.

`registerSW.js` is not referenced by `index.html`. `sw.js` still treats it as `NetworkOnly`, and `_headers` names it. Update its rev string when you bump, or delete it in the same change as those two references.

## Cache-header invariants

`_headers` in the repo asks for:

```text
/  /index.html  /rev.txt  /sw.js  /registerSW.js   →  Cache-Control: no-store
/assets/*                                            →  Cache-Control: public, max-age=0, must-revalidate
```

On 2026-10-18 the edge did not do that. Both hosts answered `/`, `/index.html`, `/rev.txt`, `/sw.js`, `/registerSW.js`, `/manifest.webmanifest`, and the JS bundle with:

```text
cache-control: public, max-age=0, must-revalidate
```

and an `ETag`. The current CDN doc, <https://surge.sh/docs/platform/cdn>, describes a different automatic policy, `Cache-Control: public, max-age=31536000, no-cache` plus an ETag, and says Surge has no cache-header configuration. The Netlify migration note says Lucid Caching replaces custom headers. This project was not sending the year-long max-age on that date.

Invariant to enforce after every publish:

- `/`, `/rev.txt`, and `/sw.js` return 200.
- `cache-control` contains a revalidation directive: `no-store`, `no-cache`, or `max-age=0`.
- A long `max-age` without `no-cache` or `must-revalidate` is a failure. The browser’s update check for `sw.js` happens outside the service worker, so a sticky worker would hide new revs.
- `max-age=31536000, no-cache` matches Surge’s written Lucid policy and is acceptable if it appears, because `no-cache` still revalidates with the ETag.
- `no-store` is what `_headers` asks for. Do not spend money trying to make Surge honor that file. Professional does not list it.
- ETA freshness does not depend on those headers. The worker’s `NetworkFirst` rule for the two ETA origins has `maxAgeSeconds: 60`.

## Checklist

- [ ] `surge whoami` on the owner’s machine (`NEED_SURGE_AUTH` until then)
- [ ] `rev.txt` is `v20260827q` and is not listed in `.surgeignore`
- [ ] `surge ./ tap-eta-hk.surge.sh` prints Success
- [ ] `surge ./ heuibin.codecoffee.online` prints Success
- [ ] `CNAME` restored to `tap-eta-hk.surge.sh`, or changed on purpose
- [ ] Namecheap NS, apex A, MX, SPF, and the heuibin CNAME still match the table above
- [ ] `surge heuibin.codecoffee.online debug status` prints `live`
- [ ] openssl SAN includes `heuibin.codecoffee.online`
- [ ] `curl -fsS https://heuibin.codecoffee.online/rev.txt` prints `v20260827q`
- [ ] `--force https` stuck, or deliberately skipped because the CLI demanded a paid plan
- [ ] Phone install from the `https://` origin, favorite survives a restart, hash routing works
- [ ] Apex `codecoffee.online` still on its own snapshot unless you meant to replace it

## Decision log

| Date | Decision |
| --- | --- |
| 2026-09-24 | `PROGRESS.md` said Surge free, no Professional, HTTPS via a Cloudflare proxy. `v20260827q` was committed and not published. |
| 2026-10-18 | Re-checked the hosts, the certificate, the zone, and Surge’s platform docs. Hosting stays on Surge free. The certificate comes from Surge’s managed cert, not from Cloudflare and not from a paid PEM upload. |
| 2026-10-18 13:01 UTC | Both app hostnames serve `v20260827q` over HTTPS. Certificate SAN is `DNS:heuibin.codecoffee.online`. HTTP is still 200. GitHub Actions publishes `main` once `SURGE_TOKEN` is set. |
