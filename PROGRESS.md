# 去邊 · 進度與 Roadmap

更新：2026-08-30

開頁就見到下一架。輕鐵按月台直行。兩下到站。

## Links

| | |
|---|---|
| 試網（HTTPS，主要用這條） | https://tap-eta-hk.surge.sh/ |
| 自定義域名 | http://heuibin.codecoffee.online （HTTP 已通；HTTPS 憑證仍是 `*.surge.sh`，不可當正式） |
| GitHub | https://github.com/Openclaaaaaw/heui-bin |
| Host | Surge 靜態頁（免費 plan） |

品牌名「去邊」。分享時寫 `heuibin`，不要寫 huaibin。

## 現況

這是個練手出貨的香港出行 PWA，不是收費產品。對手是 hkbus.app（免費無廣告、齊全）。我們不打齊全：只賣開頁見到下一架、輕鐵月台直行。

聽眾先是屯門／天水圍／元朗日日輕鐵轉屯馬的人。Launch 在 HTTPS 通之前只塞朋友與試網。

跟錢路（補習套票追蹤、Google 廣告交通站）已砍。不收費、不賣廣告、不上 App Store。

## 已上線

### 產品

- PWA「去邊」：夜光風格，分鐘比霓虹更大
- 收藏開頁出 live 到站；收藏沒有獨立搜尋
- 全域搜尋三樣一齊出（輕鐵 + 港鐵重鐵全線 + 九巴），不跟底部模式控
- 電話 3×4 數字鍵盤 + C D X M P；可搜 705／706／269C；最近搜尋 chips
- 模式控輕鐵／港鐵／九巴只濾附近
- GPS 動畫播完先問；減少動態就即刻問；點「去邊」重播蓋成頁、不再問定位
- 附近 3–5 站；地圖鎖死，開頁 fit 你同針
- 輕鐵 detail：月台全寬直行（1、2、3…），每班有下一站，沒有「最快」
- 港鐵 detail：兩個方向，不套月台；「港鐵」chip 有邊框
- 九巴：最外頁一行車號；detail 有「本站路線」
- 重新整理按鈕 loading 至少 0.5 秒，名單不跳
- 頁底：運輸署、港鐵、九巴

### 工程

- GitHub `main` 已有 code
- Surge 試網 HTTPS 正常
- Namecheap DNS：`heuibin` CNAME → `geo.surge.sh`；`www` CNAME → `geo.surge.sh`；`@` A → `138.197.235.123`

## 未完

- [ ] `heuibin.codecoffee.online` 真正 HTTPS（不買 Surge Pro；下一步 Cloudflare 代理出鎖頭）
- [ ] 入頁 layout 再閃一下：資料到就填，不要整頁 reload
- [ ] PWA 更新不要用戶自己清 cache
- [ ] HTTPS 通之後才公開分享 `heuibin.codecoffee.online`

## Roadmap

### Now

1. Cloudflare 代理 `heuibin.codecoffee.online` 出鎖頭，GPS 與加主畫面才穩。
2. 變朋友用試網 HTTPS 三日，加主畫面。Week 1 目標：20 人加了主畫面、第二朝還打開。

### Next

3. HTTPS 穩了才公開：一條連登交通／吹水，再貼屯門、天水圍或元朗街坊群。截圖只用輕鐵月台直行。不賣廣告、不上 App Store。
4. 帖文只賣一句：屯門／天水圍／元朗日日輕鐵轉屯馬，開頁就見到下一架。不提 hkbus、不講全線港鐵。

### Later（不現在）

- `heuibin.hk`：HKDNR 申請，約 HK$200／年。現在不買。有人問「去邊個網」才鎖名。
- 收費、廣告、路線規劃、App Store：不在 scope。

## 決定

- Host 留 Surge；不買 Professional US$30。
- Production 域名用已有的 `codecoffee.online` 子域名，不新買。
- 到站數據由手機直接打官方 API，不經我們伺服器。
- 官方源：運輸署／九巴 ETA、港鐵 Next Train、地政 iGeoCom `LRA`/`MTA` 座標。
