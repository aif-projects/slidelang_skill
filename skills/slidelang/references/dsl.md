# SlideLang DSL Reference

## Top-level keys

- `v`: version string, always `"sl0"`
- `fr`: `[width, height, padding]` — standard is `[1440, 810, 18]`
- `meta`: `{"id": "slide_00", "title": "..."}`
- `gd`: global defaults — `{"page": 18, "attach": 14, "gap": 8, "txtc": 10}`
- `el`: elements / containers array
- `tx`: text nodes array
- `cn`: connectors array

Do not define `th` in authored slide specs. Use a sibling `theme.json` instead.

## Theme

`decks/main/theme.json` defines deck-level styling:

```json
{
  "paper": "#F2EBDD",
  "ink": "#1A1815",
  "muted": "#6B5F49",
  "line": "#1A1815",
  "cool": "#2F4858",
  "warm": "#CC5500",
  "neutral": "#E6DDCB",
  "panel": "#E6DDCB",
  "dark": "#1A1815",
  "font_display": "Fraunces, 'Iowan Old Style', Georgia, serif",
  "font_body": "Inter, 'Helvetica Neue', Arial, sans-serif"
}
```

`font_body` is required. Legacy `font` is accepted as fallback.

## Element ops

Shape elements in `el`:

| Op | Purpose | Signature |
|----|---------|-----------|
| `b` | box / chip / card | `["b", id, x, y, w, h, style, parent, opts]` |
| `m` | module / panel rect | `["m", id, x, y, w, h, style, parent, opts]` |
| `sk` | stacked-card shorthand | `["sk", id, x, y, w, h, style, parent, opts]` |
| `l` | line | `["l", id, x, y, w, h, style, parent, opts]` |
| `c` | circle | `["c", id, x, y, w, h, style, parent, opts]` |
| `img` | image | `["img", id, x, y, w, h, "asset:alias", parent, opts]` |

Layout containers in `el`:

| Op | Purpose | Signature |
|----|---------|-----------|
| `vs` | vertical stack | `["vs", id, x, y, w, h, parent, items, opts]` |
| `hs` | horizontal stack | `["hs", id, x, y, w, h, parent, items, opts]` |
| `gr` | grid | `["gr", id, x, y, w, h, parent, cols, items, opts]` |
| `sr` | compact editorial row | `["sr", id, x, y, w, h, parent, slots, opts]` |
| `panel` | named-slot editorial panel | `["panel", id, x, y, w, h, parent, slots, opts]` |
| `z` | exclusion zone / obstacle | `["z", id, x, y, w, h, parent, opts]` |

### Container opts

Common opts across containers:
- `p`: padding
- `g`: gap between children
- `ov`: overflow policy (`fail`, `tighten_gap`, `shrink_text`, `clip`)
- `cp`: corner padding / border radius

Layout-specific:
- `vs`: `ax` (align-x), `tl` (text line budget), `td` (text density budget)
- `hs`: `ay` (align-y)
- `gr`: `gx`/`gy` (column/row gap), `cw` (column widths)
- `panel` slots: `grow` (flex grow), `lk`/`lo` (lock position), `ab`/`rb` (authoring/render budgets)
- `z`: `co` (connector obstacle), `k` (kind)

`sr` slot kinds: `["g", lane_w, glyphs, opts?]`, `["o", lane_w, symbol, opts?]`, `["v", lane_w, blocks, opts?]`

### Common element opts

- `cp`: corner padding / border radius
- `bleed`: true for elements that extend to frame edge
- `decorative`: true for non-content elements

## Text nodes

```json
["text_id", x, y, w, h, "style", "Content text", parent_or_null, {opts}]
```

Text opts:
- `fs`: font size
- `ta`: text align (`"l"`, `"center"`, `"r"`)
- `c`: color override
- `lh`: line height multiplier
- `mc`: max character budget
- `fw`: font weight
- `lockx`, `locky`: prevent compiler from repositioning on this axis
- `mdx`, `mdy`: maximum drift the compiler may apply
- `ra`: rotation angle
- `ro`: rotation origin

Common text styles: `ttc` (title), `sec` (section heading), `bdc` (body copy), `lab` (label), `mic` (micro/muted)

## Connectors

Connector kinds in `cn`:

| Kind | Purpose | Signature |
|------|---------|-----------|
| `pl` | polyline / ordinary A→B | `["pl", id, refs, style, opts?]` |
| `gi` | grouped inbound (many→one) | `["gi", id, [srcRef...], dstRef, style, bundleCoord, opts?]` |
| `go` | grouped outbound (one→many) | `["go", id, srcRef, [dstRef...], style, bundleCoord, opts?]` |
| `fi` | fan-in | `["fi", id, [srcRef...], dstRef, style, [weights...], opts?]` |

Use `pl` for ordinary A→B connections. Use `gi`/`go` when several peers converge on or fan from one hub.

Connector styles are theme-derived (e.g., `ca1`, `ca2`, `cb`). The compiler resolves them from `theme.json`. Use any style token the theme defines; common ones are `ca1` (primary accent) and `cb` (secondary).

### Anchor points

Built-in: `t b l r c tl tr bl br`
Indexed ports: `t0/3 t1/3 b2/3 l0/2 r1/3`

Prefer boundary anchors for connectors entering/leaving boxes. Example: `"BOX_A:r"` → `"BOX_B:l"`.

### Connector opts

- `cr`: rounded elbows
- `dash`: dashed line
- `op`: opacity
- `ig`: ignore obstacle IDs (array)
- `th`: line thickness

## Relative placement

Helpers for positioning elements relative to others:
- `stack_below`, `stack_above`, `stack_right_of`, `stack_left_of`
- `gap_after`, `stack_gap`
- `align_x: left|center|right`
- `align_y: top|center|bottom`

Only resolves against earlier-declared nodes.

## Budgets

Authoring block (`ab`):
```json
{"ab": {"pl": 10, "pd": 0.42, "mc": 180, "mode": "editorial"}}
```

Render block (`rb`):
```json
{"rb": {"hl": 12, "hd": 0.5, "ov": "fail", "min_fs": 11, "min_gap": 6}}
```

- `pd` / `hd`: preferred / hard density (child text area / parent content area)
- `pl` / `hl`: preferred / hard line budget
- `mc`: char budget override
- `ov`: overflow policy
- Large regions often default density to `0.42`

## Overflow policies

- `fail`: hard stop on overflow (default for editorial content)
- `tighten_gap`: reduce spacing to fit
- `shrink_text`: reduce font size to fit
- `clip`: clip overflow (decorative only)

## Images in slides

```json
["img", "BG", 0, 0, 1440, 810, "asset:hero_bg", null, {"bleed": true, "par": "xMidYMid slice"}]
```

- Reference assets by `asset:<alias>` where alias matches the id in `deck_plan.json`
- `bleed: true` for frame-filling images
- `decorative: true` for non-content images

## Complete slide example

```json
{
  "v": "sl0",
  "fr": [1440, 810, 18],
  "meta": {"id": "slide_03", "title": "Tools and MCP"},
  "gd": {"page": 18, "attach": 14, "gap": 8, "txtc": 10},
  "el": [
    ["b", "S1", 100, 220, 220, 76, "pn", null, {"cp": 16}],
    ["b", "S2", 100, 312, 220, 76, "pn", null, {"cp": 16}],
    ["b", "S3", 100, 404, 220, 76, "pn", null, {"cp": 16}],
    ["b", "S4", 100, 496, 220, 76, "pn", null, {"cp": 16}],
    ["b", "HUB", 540, 296, 280, 200, "kd", null, {"cp": 24}],
    ["b", "EXP", 880, 220, 488, 432, "sqb", null, {"cp": 28}]
  ],
  "tx": [
    ["title", 72, 56, 1280, 60, "ttc", "Tools and MCP", null, {"fs": 50, "ta": "l", "c": "#1A1815", "mc": 18}],
    ["dek", 74, 124, 1280, 30, "mic", "Built-in tools, plus the Model Context Protocol.", null, {"fs": 21, "ta": "l", "c": "#6B5F49", "mc": 110}],
    ["s1_t", 122, 246, 180, 28, "sec", "Filesystem", "S1", {"fs": 20, "ta": "l", "c": "#1A1815", "mc": 14}],
    ["s2_t", 122, 338, 180, 28, "sec", "GitHub", "S2", {"fs": 20, "ta": "l", "c": "#1A1815", "mc": 14}],
    ["s3_t", 122, 430, 180, 28, "sec", "Database", "S3", {"fs": 20, "ta": "l", "c": "#1A1815", "mc": 14}],
    ["s4_t", 122, 522, 180, 28, "sec", "Web fetch", "S4", {"fs": 20, "ta": "l", "c": "#1A1815", "mc": 14}],
    ["hub_t", 562, 360, 240, 36, "sec", "Claude Code", "HUB", {"fs": 28, "ta": "center", "c": "#F2EBDD", "mc": 14}],
    ["exp_h", 906, 250, 440, 36, "sec", "Bring your own tools", "EXP", {"fs": 28, "ta": "l", "c": "#CC5500", "mc": 24}],
    ["exp_b", 906, 308, 440, 320, "bdc", "MCP servers expose data and actions as typed tools.", "EXP", {"fs": 21, "ta": "l", "lh": 1.32, "c": "#1A1815", "mc": 200}]
  ],
  "cn": [
    ["fi", "fan", ["S1:r", "S2:r", "S3:r", "S4:r"], "HUB:l", "ca1", [3.2, 3.2, 3.2, 3.2], {}]
  ]
}
```
