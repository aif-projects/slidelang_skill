# SlideLang Reference

Purpose: compact agent-facing DSL reference. Prefer this over README for ICL.

## Core

- top-level keys:
  - `meta`: id + title
  - `fr`: `[width, height, padding]`
  - `el`: elements / containers
  - `tx`: text nodes
  - `cn`: connectors
- `gd`: global guards
- authored slide specs must not define `th`
- each deck must provide sibling `theme.json`
- `theme.json`: `font_body` is the canonical required body font; legacy `font` is still accepted and used as fallback

## Theme

- `theme.json` defines palette + fonts only. Do not manually define tokens like `pn`, `cb`, or `ttc`.
- required theme fields:
  - `paper`
  - `ink`
  - `muted`
  - `line`
  - `cool`
  - `warm`
  - `neutral`
  - `panel`
  - `dark`
- optional theme fields:
  - `name`
  - `font`
  - `font_body`
  - `font_display`
- runtime style groups are derived from those fields:
  - `box` styles for `m` / `b`
  - `shape` styles for `l` / `c`
  - `text` styles for `tx`
  - `conn` styles for `cn`
- common derived tokens by group (non-exhaustive):
  - `box`: `pn`, `qa`, `qb`, `kd`, `sqw`, `sqb`, `dst`
  - `shape`: `dv`, `ink`, `oc`, `ocg`, `cb`
  - `text`: `ttc`, `sec`, `bdc`, `mic`, `lab`
  - `conn`: `ca`, `ca1`, `cb`, `ink`, `gsa`
- these are examples, not the full runtime token set
- wrong-group example:
  - `pn` is a `box` style, so `["l", ..., "pn"]` is invalid
  - use a `shape` style like `dv` or `ink` on `l`

## Ops

- shapes:
  - `m`: module / panel rect
  - `b`: box / chip / card rect
  - `sk`: stacked-card shorthand
  - `l`: line
  - `c`: circle
  - `img`: image
- shape signatures:
  - `l = ["l", id, x1, y1, x2, y2, style, opts?]`
  - `c = ["c", id, cx, cy, r, style, opts?]`
- layout:
  - `vs`: vertical stack
  - `hs`: horizontal stack
  - `gr`: grid
  - `sr`: compact editorial row
  - `panel`: named-slot editorial panel
  - `z`: exclusion zone / grouped obstacle
- legacy:
  - `vp` lowers through `vs`

## Connectors

- kinds:
  - `pl`: ordinary connector / manual polyline
  - `gi`: grouped inbound
  - `go`: grouped outbound
- rule:
  - use `pl` for ordinary `A -> B`
  - use `gi` when several peers converge on one hub edge and should read as one grouped flow
  - use `go` when one hub fans to multiple targets and should read as one grouped flow
- signatures:
  - `pl = ["pl", id, refs, style, opts?]`
  - `gi = ["gi", id, [srcRef...], dstRef, style, bundleCoord, opts?]`
  - `go = ["go", id, srcRef, [dstRef...], style, bundleCoord, opts?]`
- grouped-family behavior:
  - `gi` draws multiple branches into one shared inbound trunk with one terminal head at the sink
  - `go` draws one outbound trunk from the source and branches to many headed leaves
- connector opts:
  - `cr`: rounded elbows
  - `dash`
  - `op`
  - `ig`: ignore obstacle ids
  - `th`: line thickness
- anchors:
  - built-in: `t b l r c tl tr bl br`
  - indexed ports: `t0/3 t1/3 b2/3 l0/2 r1/3`
  - prefer boundary anchors for connectors entering/leaving boxes
  - raw interior starts trigger `connector_internal_endpoint`
- examples:
  - `gi = ["gi", "c1", ["A:r", "B:r", "C:r"], "HUB:l", "cb", 720, {"th": 3.2}]`
  - `go = ["go", "c2", "HUB:r", ["A:l", "B:l", "C:l"], "cb", 980, {"th": 3.2}]`

## Layout Primitives

- `vs = ["vs", id, x, y, w, h, parent, items, opts]`
  - opts: `p g ax tl td ov cp`
- `hs = ["hs", id, x, y, w, h, parent, items, opts]`
  - opts: `p g ay ov`
- `gr = ["gr", id, x, y, w, h, parent, cols, items, opts]`
  - opts: `p g gx gy cw ov`
- `sr = ["sr", id, x, y, w, h, parent, slots, opts]`
  - slot kinds:
    - `["g", lane_w, glyphs, opts?]`
    - `["o", lane_w, symbol, opts?]`
    - `["v", lane_w, blocks, opts?]`
- `panel = ["panel", id, x, y, w, h, parent, slots, opts]`
  - slot opts: `p grow lk lo ab rb`
- `z = ["z", id, x, y, w, h, parent, opts]`
  - opts: `g co k`

## Text

- full-node TeX:
  - `$...$` for inline math
  - `$$...$$` for display math
- mixed prose with inline TeX is supported inside one text string
- text opts:
  - `{"math": true}` treats the whole node as inline math when delimiters are omitted
  - `{"math": "display"}` treats the whole node as display math when delimiters are omitted

## Relative Placement

- helpers:
  - `stack_below`
  - `stack_above`
  - `stack_right_of`
  - `stack_left_of`
  - `gap_after`
  - `stack_gap`
  - `align_x: left|center|right`
  - `align_y: top|center|bottom`
- only resolves against earlier-declared nodes

## Layout / Resolve Model

- local only; no global slide solve
- pipeline:
  1. estimate intrinsic text
  2. estimate intrinsic row/container size
  3. place children inside `vs` / `hs` / `gr`
  4. apply overflow policy
  5. run preflight

## Budgets

- authoring block:

```json
{"ab": {"pl": 10, "pd": 0.42, "mc": 180, "mode": "editorial"}}
```

- render block:

```json
{"rb": {"hl": 12, "hd": 0.5, "ov": "fail", "min_fs": 11, "min_gap": 6}}
```

- usage:
  - flat opts on top-level boxes/modules are the normal surface: `td tdp tl tlp mc mcp ov`
  - `ab` / `rb` are aliases that expand into those flat keys
  - `ab.pd` maps to preferred density only
  - if you must raise the hard density threshold, use `td` or `rb.hd`

- authoring keys:
  - `pl`: preferred line budget
  - `pd`: preferred density budget
  - `mc`: preferred char budget override
  - `mode`: archetype hint
- render keys:
  - `hl`: hard line budget
  - `hd`: hard density budget
  - `mc`: hard char budget override
  - `ov`: overflow policy
  - `min_fs`
  - `min_gap`
- density:
  - parent density = child text-box area / parent content area
  - large regions often default to `0.42`
  - oversized text node `h` counts against density even if copy is short
  - keep text-node `h` tight
- `mc` on text nodes is optional; compiler derives it from current string length

## Theme Inheritance

- some box styles define child-text defaults
- `kd` forces light child text unless color is explicitly overridden

## Overflow

- container overflow policies:
  - `fail`
  - `tighten_gap`
  - `shrink_text`
  - `clip` for decorative only
- editorial default should usually be `fail`

## Images

- roles:
  - `ref`: composition / layout only
  - `asset`: embeddable image
- policy:
  - do not treat assets as last resort only
  - on many technical decks, the strongest result uses 2-4 well-chosen assets, not just a single hero image
  - default pattern to consider: 1 hero/frame-filling asset plus 1-2 supporting assets on content slides
  - ask per slide: native, asset, or hybrid
  - use assets when they replace fake placeholders with real visuals
  - do not stop at the opener if later slides still need real imagery
  - keep formulas, labels, connectors, and simple diagrams native
  - refs do not choose palette, branding, or typography
- asset background policy:
  - `background_policy: "frame_fill"` = image owns full panel / frame
  - `background_policy: "transparent_if_supported"` = isolated object / supporting visual
  - `background_policy: "paper_match"` = explicit fallback only, not default
- deck plan fields:
  - `visual_ref_prompt`
  - `visual_mode: "asset"`
  - `visual_asset_id`
  - `visual_background_policy`
  - `assets: [...]`
- example:

```json
{
  "stem": "slide_hero",
  "visual_mode": "asset",
  "visual_asset_id": "hero_bg",
  "visual_background_policy": "frame_fill",
  "visual_ref_prompt": "Neutral wireframe-like layout reference with a dominant hero region and clear text-safe overlay area. No palette direction.",
  "assets": [
    {"id": "detail_inset", "mode": "asset", "role": "supporting_visual", "background_policy": "transparent_if_supported", "prompt": "Clean cropped detail. No text."}
  ]
}
```

- generate:
  - `npm run images -- --project-root /abs/path/to/project`
  - `npm run images -- --project-root /abs/path/to/project --slide slide_hero --asset hero_bg --retry`
- outputs:
  - `assets/refs/`
  - `assets/generated/`
  - alias registration in `manifest.json`
- layout helpers:
  - `bleed: true`
  - `decorative: true`

## Charts

- purpose:
  - data-bound inline SVG charts for quantitative explanatory visuals
- supported kinds:
  - `scatter`
  - `line`
  - `bar`
- supported marks:
  - `dot`
  - `line`
  - `fit`
  - `bar`
- supported scales:
  - `linear`
  - `log`
- supported axis formats:
  - `auto`
  - `int`
  - `plain`
  - `usd`
  - `pct`
- signature:

```json
["ch", "curve", 96, 120, 620, 360, null, {
  "kind": "scatter",
  "data": [{"x": 1, "y": 80}, {"x": 10, "y": 8}],
  "x": {"field": "x", "type": "quantitative", "scale": "log", "label": "Cumulative output", "format": "int"},
  "y": {"field": "y", "type": "quantitative", "scale": "log", "label": "Cost", "format": "usd"},
  "marks": ["dot", "fit"],
  "series_color": "cool",
  "gridlines": {"x": true, "y": true},
  "annotations": [
    {"kind": "slope-label", "text": "slope ≈ -0.40", "at": [0.58, 0.42]},
    {"kind": "point-label", "target": "last", "text": "2023 · $0.15/W", "dx": 12, "dy": -8},
    {"kind": "reference-line", "axis": "y", "value": 1, "label": "$1/W", "dash": "6 4"}
  ],
  "caption": "FIG. 2 — Wright's Law in log-log space."
}]
```

- data forms:
  - flat rows for single-series charts
  - `[{name, data: [...]}, ...]` for multi-series charts
  - multi-series line entries may include `dash`, e.g. `{"name":"FLOPs","dash":"7 5","data":[...]}` for deterministic dashed strokes
- annotations:
  - `slope-label`: free text positioned by plot-relative `[fx, fy]`
  - `point-label`: attaches text to `"first"`, `"last"`, or `{series?, index}`
  - `reference-line`: draws a quantitative rule on axis `x` or `y`
- notes:
  - legends are out of scope; use `series.name` plus point labels
  - bar charts are single-series only in this MVP
  - axis label/tick typography comes from the theme's micro text tokens

- multi-series line example:

```json
["ch", "learning_rates", 96, 120, 640, 340, null, {
  "kind": "line",
  "data": [
    {"name": "LR 20%", "data": [{"x": 1, "y": 100}, {"x": 8, "y": 64}]},
    {"name": "LR 30%", "data": [{"x": 1, "y": 100}, {"x": 8, "y": 49}]}
  ],
  "x": {"field": "x", "scale": "log", "label": "Cumulative production", "format": "int"},
  "y": {"field": "y", "scale": "log", "label": "Cost index", "format": "int"},
  "marks": ["line", "dot"],
  "palette": ["cool", "warm"],
  "annotations": [
    {"kind": "point-label", "target": {"series": "LR 20%", "index": 1}, "text": "20% LR", "dx": 10, "dy": -8},
    {"kind": "point-label", "target": {"series": "LR 30%", "index": 1}, "text": "30% LR", "dx": 10, "dy": 16}
  ]
}]
```

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
    ["gi", "fan", ["S1:r", "S2:r", "S3:r", "S4:r"], "HUB:l", "ca1", 420, {"th": 3.2}]
  ]
}
```
