# 去邊 review rules

This is a static Hong Kong commute PWA. There is no server and no `package.json`. The phone calls the KMB and MTR open-data APIs. Surge only serves files.

Flag a change that:

- Lets `rev.txt`, the `tap-eta-rev` meta tag, the inline `REV`, `assets/index-<rev>.js`, `assets/index-<rev>.css`, and the `sw.js` cache names disagree.
- Adds `rev.txt` to `.surgeignore`. The publish must upload that file.
- Calls `skipWaiting()` on install. The worker may call it only after the page posts `{type:'SKIP_WAITING'}`.
- Publishes `codecoffee.online`, or passes `--force https`, from `.github/workflows/ci.yml`.
- Puts a Surge token, password, or account email into the repo or the workflow. `SURGE_TOKEN` belongs in GitHub Actions secrets.
- Breaks hash routes (`#/`, `#/search`, `#/eta/...`) or stores favorites anywhere except `localStorage` on the phone.

Do not ask for a backend, a VM, or a paid Surge plan to fix a static-file issue.
