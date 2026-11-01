# Design System — 去邊

## Direction

**Personality:** Utility & Function

**Foundation:** cool asphalt, night street

**Depth:** borders-only. Neon is a signboard, not a second elevation system.

Jacob is on a Hong Kong street or at a stop, phone in one hand, looking for the next bus or train in Cantonese. The screen has one job: the next departure. Everything else is a kicker, a bound, or a control.

Feel: a platform LED and a route plate, not a SaaS dashboard. Classic night-street neon — cyan and magenta — is the signature and it is scarce. About 60% asphalt structure, 30% muted LED text, 10% neon.

Domain this came from: street poles, Octopus readers, platform LEDs, Nathan Road neon, wet pavement, route-number pills, leave-now urgency.

Rejecting: purple/indigo gradients, soft card shadows, Inter/size-only hierarchy, identical floating cards, glow on ETA rows.

## Tokens

### Spacing

Base: 4px

Scale: 4, 8, 12, 16, 20, 24, 32 (`--space-1` through `--space-6`, `--space-8`)

| Token | Value | Use |
| --- | --- | --- |
| `--gutter` | 16px | Page inset, plus the safe-area |
| `--card-pad-y` / `--card-pad-x` | 12px / 16px | Inside a card or ETA row |
| `--section-gap` | 20px | Between 常用, 附近, 釘選, settings, search |
| `--mode-bar-h` | 60px | Bottom mode reserve |

Stop-page bottom reserves stay 120px, and 148px while the arrival note is open. Do not pull those onto the spacing scale.

### Colors

Ink is four levels. Surfaces shift lightness only. Neon and streetlight are the only hues.

```
--ink-primary:   #f2f6f8   LED white. Stop names, headings, the countdown.
--ink-secondary: #c5d4dc   Bounds, destinations, walk minutes.
--ink-muted:     #8fa0a8   English names, hints, platform remarks, footer.
--ink-faint:     #788086   Kickers: 常用, 釘選, 路線. Still 4.5:1 on asphalt.

--surface-0:     #0e1418   Page asphalt. Also --bg / --bg0.
--surface-1:     #121a20   Raised bar, nearest-stop plate.
--surface-2:     #182228   Pressed control, quiet selected fill.
--surface-deep:  #0c1216   Bottom of the night ramp.
--surface-card:  #ffffff0a Whisper card. Favorites, settings, search hits.
--surface-inset: #ffffff08 Flat ETA row.

--line:          #ffffff14 Hairline. Findable, not the first thing you see.
--line-strong:   #ffffff24 Emphasis edge, armed reminder.

--neon-cyan:     #19e6ff   KMB / LRT / bus mode, nearest stop, selected route.
--neon-magenta:  #ff2bd6   MTR / Tuen Ma mode only.
--streetlight:   #f0c14b   Stale minutes and the Citybus chip edge. Nowhere else.
--streetlight-ink: #f3ddb0
--pin:           #d9c48a   Saved-stop star. Warm, no glow.
--danger:        #ff7b9a   Missed departure, destructive confirm.

--sign-cyan:     0 0 10px #19e6ff66, 0 0 22px #19e6ff2e
--sign-magenta:  0 0 6px #ff2bd6b3, 0 0 14px #ff2bd640
--sign-plate:    0 0 8px #19e6ff99, 0 0 16px #19e6ff38
```

`--text`, `--ink`, `--muted`, `--bg`, `--cyan`, `--magenta`, `--accent`, and `--accent-2` alias the tokens above. Do not introduce a new hex in a component.

Operator chips carry identity in the border only (cyan, magenta, streetlight, green-minibus, New Lantao). The label stays `--ink-secondary`.

### Radius

Scale: 8px controls (`--radius-sm`), 12px keys and fields (`--radius-md`), 14px cards (`--radius` / `--radius-lg`), 999px pills.

A search field is not rounder than a stop card.

### Typography

Font: `system-ui, PingFang HK, Noto Sans TC, Noto Sans CJK TC, sans-serif`

Noto stays in the stack so a desktop without a CJK system face still renders Cantonese. On a phone, system-ui / PingFang leads.

Hierarchy is weight + ink. Size steps that already exist:

| Role | Size | Weight | Ink |
| --- | --- | --- | --- |
| Kicker | 0.78rem | 600 | faint, tracked |
| Meta / hint | 0.75–0.82rem | 400 | muted |
| Body / bound | 0.88rem | 500 | secondary |
| Stop name | 1.05rem | 700 (800 if nearest) | primary |
| Section (附近) | 1.16rem | 800 | primary |
| Stop title | 1.32rem | 900 | primary, slight negative tracking |
| Hero countdown | 2.15rem | 900 | primary, tabular-nums |

ETAs, fares, walk minutes, and platform sequence use `tabular-nums`. Headings use `text-wrap: balance`. Hints and remarks use `text-wrap: pretty`.

## Patterns

### Button

- Height: 44px minimum
- Padding: 0 16px
- Radius: pill
- Font: 1rem, 600; primary label 700
- Default: transparent fill, `--line` border, `--ink-muted` or `--ink-primary`
- Primary: `--surface-2` fill, `--line-strong` border, no glow
- Active: `scale(0.98)`, 120ms `cubic-bezier(0.23, 1, 0.32, 1)`
- Focus: 2px cyan outline, 2px offset
- Disabled / loading: opacity 0.7, spinner, no extra motion

### Mode chip

- Height: 44px, equal flex, radius 12px
- Off: `--ink-muted`, weight 600, hairline, no shadow
- On: LED white, weight 800, neon border, `--sign-cyan` or `--sign-magenta`
- Cyan: 巴士, 九巴, 輕鐵. Magenta: 港鐵, 屯馬. No third glow color.

### Route pill

- Height: 44px on the stop page and in the recent row
- Off: `--surface-card`, hairline, `--ink-primary`, weight 700
- On (the selected route only): `#041820` on `#3eecff`, `--sign-plate`
- List chips under a stop card are 44px hit targets. They are not signboards.

### Card

- Favorites, pins, search hits, settings rows: 1px `--line`, `--surface-card`, radius 14px, padding 12px 16px, no shadow, no gradient
- Nearby list is not a stack of those cards. Rows are flat, separated by a hairline, gap 0
- The nearest stop is the one signboard card: `--surface-1`, cyan border, `--sign-cyan`

### ETA row

- Flat. `--surface-inset`, hairline, padding 12px 16px, no glow, no gradient, no lift
- The first live minute is the hero (2.15rem / 900). The route number beside it is primary / 800. Later rows drop to muted route numbers and a smaller minute
- A status with no number (暫時沒有班次, a long remark) is muted / 600 / 0.92rem. It does not borrow the countdown size
- Stale minutes stay `--streetlight-ink`. Skeleton text stays transparent. Those two beat the hero color
- A cached ETA must not wear the live white

### Signboard (signature)

Paint `--sign-cyan`, `--sign-magenta`, or `--sign-plate` on exactly three things:

1. Corner blooms on the page (cyan top-left, magenta top-right)
2. The nearest stop, and the active mode chip
3. The selected route pill

`prefers-reduced-transparency` drops the corner blooms. Do not put the glow on ETA rows, the refresh bar, the install sheet, the update pill, the fastest badge, or a direction chip.

## Decisions

| Decision | Rationale | Date |
| --- | --- | --- |
| Borders-only depth | Glanceable commute tool. Shadows add weight and no information. | 2026-11-01 |
| 4px spacing base | Already shipped as `--space-*`. Off-grid one-offs read as no system. | 2026-10-21 |
| Neon on three chrome pieces | Night-street signature without turning the ETA list into a poster. | 2026-10-27 |
| Four ink levels | Weight and opacity separate a kicker from a stop name from a minute. Size alone was mush. | 2026-11-01 |
| Nearby list vs favorite cards | The nearest stop is the object. The stops behind it are a list. Favorites stay quiet cards. | 2026-11-01 |
| system-ui first | A phone utility should use the Hong Kong system face. Noto remains the fallback. | 2026-11-01 |
