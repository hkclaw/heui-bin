# 去邊 · 進度與 Roadmap

更新：2026-10-18

**2026-10-18 取代：** 下面 2026-09-24「HTTPS 用 Cloudflare proxy、唔買 Surge Pro」不再執行。Surge 免費計劃已包括自定義域名同自動 managed certificate。生產環境係 Surge 免費靜態托管。

**2026-10-18 13:01 UTC：** `https://heuibin.codecoffee.online/` 同 `https://tap-eta-hk.surge.sh/` 都係 `v20260827q`，證個名係 `heuibin.codecoffee.online`。HTTP 仍然 200，未做 `--force https`。之後 push `main` 由 `.github/workflows/ci.yml` 發布，要 repo secret `SURGE_TOKEN`。步驟見 [PRODUCTION.md](PRODUCTION.md)。

更新：2026-09-24

開頁就見到下一架。輕鐵按月台直行。兩下到站。

## Links

| | |
|---|---|
| 試網（HTTPS，主要用這條） | https://tap-eta-hk.surge.sh/ |
| 自定義域名 | https://heuibin.codecoffee.online/ （2026-10-18 13:01 UTC：HTTPS 200，rev `v20260827q`，證 CN=`heuibin.codecoffee.online`。HTTP 仍未跳去 HTTPS。） |
| GitHub | https://github.com/hkclaw/heui-bin |
| Host | Surge 靜態頁（免費 plan；唔買 Pro） |

品牌名「去邊」。分享時寫 `heuibin`，不要寫 huaibin。

## 現況

練手出貨的香港出行 PWA。對手是 hkbus.app。我們不打齊全：只賣開頁見到下一架、輕鐵月台直行。

## 已上線（摘要）

- PWA「去邊」、收藏 live ETA、全域搜尋、輕鐵月台直行、港鐵／九巴 detail
- Rev `v20260827q`：PWA「有新版本 · 更新」banner、Web Share／clipboard 分享、rev/cache bump

## 未完

- [x] `heuibin.codecoffee.online` 真正 HTTPS（Surge 免費 managed certificate，2026-10-18 已核對 SAN）
- [x] `v20260827q` 已發布到兩個 app hostname
- [ ] GitHub Actions 要 repo secret `SURGE_TOKEN` 先會自動再發布
- [ ] `.surgeignore` 已忽略舊 `assets/index-v20260827{c–p}.*`；檔仍然留喺 git

## 決定

- 2026-09-24（已作廢）：Host 留 Surge；HTTPS 用 Cloudflare proxy，不買 Professional。
- 2026-10-18：Host 仍然留 Surge 免費計劃。鎖頭用 Surge managed certificate，唔買 Professional，唔加 Cloudflare，唔買 VM。步驟在 PRODUCTION.md。
- 到站數據由手機直接打官方 API。
