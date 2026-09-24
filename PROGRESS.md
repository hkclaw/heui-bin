# 去邊 · 進度與 Roadmap

更新：2026-09-24

開頁就見到下一架。輕鐵按月台直行。兩下到站。

## Links

| | |
|---|---|
| 試網（HTTPS，主要用這條） | https://tap-eta-hk.surge.sh/ |
| 自定義域名 | http://heuibin.codecoffee.online （HTTP 已通；HTTPS 仍靠 Cloudflare proxy，未完成） |
| GitHub | https://github.com/hkclaw/heui-bin |
| Host | Surge 靜態頁（免費 plan；唔買 Pro） |

品牌名「去邊」。分享時寫 `heuibin`，不要寫 huaibin。

## 現況

練手出貨的香港出行 PWA。對手是 hkbus.app。我們不打齊全：只賣開頁見到下一架、輕鐵月台直行。

## 已上線（摘要）

- PWA「去邊」、收藏 live ETA、全域搜尋、輕鐵月台直行、港鐵／九巴 detail
- Rev `v20260827q`：PWA「有新版本 · 更新」banner、Web Share／clipboard 分享、rev/cache bump

## 未完

- [ ] `heuibin.codecoffee.online` 真正 HTTPS（Cloudflare 代理出鎖頭；唔買 Surge Pro）
- [ ] Surge republish 要 box 上有 token（NEED_SURGE_AUTH）
- [ ] `.surgeignore` 清走舊 `assets/index-v20260827{c–p}.*` 減少 upload

## 決定

- Host 留 Surge；HTTPS 用 Cloudflare proxy，不買 Professional。
- 到站數據由手機直接打官方 API。
