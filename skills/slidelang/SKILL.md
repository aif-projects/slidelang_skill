---
name: slidelang
description: Create, revise, and publish presentation decks using SlideLang. Trigger when asked to make a slide deck, presentation, or slides about any topic, or to update/republish an existing SlideLang deck.
---

# SlideLang

Use this skill to create new presentation decks or revise existing ones using the SlideLang DSL.

SlideLang is a compact JSON-based slide language optimized for agent-driven generation. You author small structural specs, the compiler handles deterministic layout, preflight checks, and linting, then you iterate until the deck is clean and publish it to a hosted presenter.

## Setup

This skill ships its own thin-client toolchain. Before first use, install dependencies from the skill's root directory (the directory containing this skill's `package.json`, two levels above `skills/slidelang/`):

```bash
cd <skill-root> && npm install
```

To find the skill root: it is the parent of the `skills/` directory that contains this `SKILL.md`. Look for `package.json` there.

The toolchain requires network access — image generation, check, budget, repair-plan, publish, and pull all call the hosted SlideLang API. Only scaffolding (`deck-scratch`) and `list`/`show` work offline.

## Running commands

All `npm run` commands must execute from the skill root directory. Use `DECKS_DATA_ROOT` to control where deck projects are stored. If unset, projects default to `./slidelang-projects/` relative to the current working directory.

To store decks in the user's project:

```bash
DECKS_DATA_ROOT=/path/to/user/project/slidelang-projects npm run --prefix <skill-root> <command> -- <args>
```

Or more concisely with `cd`:

```bash
cd <skill-root> && DECKS_DATA_ROOT=<user-cwd>/slidelang-projects npm run <command> -- <args>
```

Throughout this skill, `<skill-root>` means the skill's root directory and `<projects-dir>` means the `DECKS_DATA_ROOT` path.

## Deciding: new deck or revise existing?

- If the user asks to **create** a deck about a topic → start at **Phase 1: Scaffold**.
- If the user asks to **update/revise/fix** an existing deck → start at **Phase 5: Revise**.
- If unsure, run `npm run projects -- list` to see what exists.

---

## Phase 1: Scaffold a new project

Choose a short kebab-case project id from the topic.

```bash
npm run deck-scratch -- --project-id <project-id> --intent "<what the deck is about, audience, and purpose>"
```

This creates `<projects-dir>/<project-id>/` with:
- `manifest.json`
- `brief/brief.json` and `brief/AUTHORING_GUIDE.md`
- empty `decks/main/`, `assets/refs/`, `assets/generated/`

The full project directory path is `<projects-dir>/<project-id>` — use this as `<project-dir>` in later commands.

Read `brief/AUTHORING_GUIDE.md` before proceeding — it contains project-specific authoring constraints generated from the intent.

## Phase 2: Plan the deck

Create `brief/deck_plan.json` in the project directory. This defines every slide, its goal, visual mode, and any image generation prompts.

Structure:

```json
{
  "title": "Deck Title",
  "subtitle": "Optional subtitle",
  "slides": [
    {
      "stem": "slide_00",
      "title": "Slide Title",
      "goal": "What this slide should accomplish for the viewer.",
      "visual_ref_prompt": "Composition reference prompt for layout planning. Placeholder lorem only, no real text.",
      "visual_mode": "native"
    },
    {
      "stem": "slide_01",
      "title": "Hero Slide",
      "goal": "...",
      "visual_ref_prompt": "...",
      "visual_mode": "asset",
      "visual_asset_id": "hero_bg",
      "visual_background_policy": "frame_fill",
      "assets": [
        {
          "id": "hero_bg",
          "mode": "asset",
          "prompt": "Descriptive image prompt. No legible text in the image.",
          "background_policy": "frame_fill"
        }
      ]
    }
  ]
}
```

Visual mode per slide:
- `native` — boxes, arrows, text, diagrams drawn by the layout engine
- `asset` — uses a generated image (hero, illustration, etc.)
- `hybrid` — combines native elements with a generated image

Image guidelines:
- Do not treat assets as a last resort. Many technical decks benefit from 2-4 assets.
- Default pattern: 1 hero/frame-filling asset + 1-2 supporting assets on content slides.
- Use `frame_fill` when the image owns its full panel. Use `transparent_if_supported` for isolated objects.
- Keep formulas, connector logic, labels, and simple diagrams native.
- Good asset targets: physical scenes, textures, UI collages, illustrative metaphors, anything the layout engine would fake badly.

## Phase 3: Generate images

```bash
npm run images -- --project-root <project-dir>
```

This reads `brief/deck_plan.json` and generates:
- Composition refs under `assets/refs/` (layout guidance only, not on final slides)
- Embeddable assets under `assets/generated/` (appear on final slides)
- Auto-registers assets in `manifest.json`

Focused retries for specific slides or assets:

```bash
npm run images -- --project-root <project-dir> --slide slide_03
npm run images -- --project-root <project-dir> --slide slide_00 --asset hero_bg --retry
```

Generate refs/assets before creating slide files — slides that reference missing assets will fail validation.

## Phase 4: Author the deck

### 4a. Create the theme

Create `decks/main/theme.json` in the project directory with colors and fonts for the deck. See `references/dsl.md` for the full theme schema and an example.

- `font_body` is required. `font_display` is for headings.
- `theme.json` defines palette and fonts only. Runtime style tokens like `pn`, `ttc`, `dv`, and `ca1` are derived automatically.
- Theme tokens are group-specific:
  - `box` styles for `m` / `b`
  - `shape` styles for `l` / `c`
  - `text` styles for `tx`
  - `conn` styles for `cn`
- If you see a style-group error, the usual cause is using a token from the wrong group. Example: `pn` is valid on `b` but invalid on `l`.
- On dark themes, `line` must be materially lighter than `paper` or contrast lint will fail.
- Choose a unique design direction per deck — do not copy themes from other decks.

### 4b. Author slides

Create `decks/main/slide_00.sl.json`, `slide_01.sl.json`, etc. in the project directory.

Each slide is a JSON spec. See `references/dsl.md` for the full DSL reference, but the core structure:

```json
{
  "v": "sl0",
  "fr": [1440, 810, 18],
  "meta": {"id": "slide_00", "title": "Slide Title"},
  "gd": {"page": 18, "attach": 14, "gap": 8, "txtc": 10},
  "el": [
    ["b", "BOX_ID", x, y, w, h, "style", parent_or_null, {opts}],
    ["m", "MOD_ID", x, y, w, h, "style", parent_or_null, {opts}],
    ["ch", "CHART_ID", x, y, w, h, parent_or_null, {chart_spec}]
  ],
  "tx": [
    ["text_id", x, y, w, h, "style", "Text content", parent_or_null, {opts}]
  ],
  "cn": [
    ["pl", "conn_id", ["FROM:r", "TO:l"], "style", {opts}]
  ]
}
```

Text nodes support TeX math:
- `$...$` for inline math
- `$$...$$` for display math
- `{"math": true}` or `{"math": "display"}` when you want the whole node treated as math without delimiters

Data-bound charts use the `ch` element kind. Reach for it on quantitative slides instead of hand-placing `l` and `c` primitives. Supports `scatter` / `line` / `bar` with log or linear scales, fit lines, and first-class annotations (slope label, point label, reference line). See `references/dsl.md` for the full signature and examples.

Update `manifest.json` to list slides:

```json
"slides": [
  {"spec": "decks/main/slide_00.sl.json"},
  {"spec": "decks/main/slide_01.sl.json"}
]
```

### Design principles

- Prefer explanatory visuals over decorative visuals.
- Establish a visual vocabulary early and keep it stable across slides.
- Reuse colors, symbols, and shapes consistently once they have meaning.
- Build on earlier diagrams rather than replacing them when concepts evolve.
- Text-heavy slides are draft state, not the goal.
- If technical confidence is low, simplify the mechanism — do not invent specifics.

## Phase 5: Revise an existing deck

For an existing published deck:

1. Pull latest source (this creates the local project directory if it doesn't exist yet):
   ```bash
   npm run projects -- pull <project-id> slidemaker
   ```

2. Read the current slides under `decks/main/` and `brief/deck_plan.json` to understand what exists.

3. Make targeted edits to the slide `.sl.json` files, theme, or deck plan as needed.

4. If adding new image assets, update `brief/deck_plan.json` and re-run image generation.

5. Proceed to **Phase 6** to validate and republish.

Publish will fail if the cloud version changed since your pull — if so, pull again before editing. Note: `pull` overwrites local source files. If you have uncommitted local edits, back them up before re-pulling.

## Phase 6: Validate and publish

All workflow commands take a target argument. Use `slidemaker` — it is the default target for presenter decks.

### Iteration loop

```bash
# Check budget before first publish on a new deck
npm run projects -- budget <project-id> slidemaker

# Fast validation (no PNGs, no browser lint)
npm run projects -- check <project-id> slidemaker

# Get repair suggestions when stuck (requires check to have run first)
npm run projects -- repair-plan <project-id> slidemaker [slide_id]

# Publish (compiles and uploads to hosted service)
npm run projects -- publish <project-id> slidemaker
```

### Reading results

Start with the top-level summary. Note: `check` and `publish` write to different paths — `check` uses a `/check/` subdirectory:
- After `check`: `publish/slidemaker/check/workflow_summary.json`
- After `publish`: `publish/slidemaker/workflow_summary.json`

Then drill into per-slide artifacts as needed (paths mirror the parent — use `/check/slides/` after `check`, `/slides/` after `publish`):
- After `check`: `publish/slidemaker/check/slides/slide_00.summary.json`
- After `publish`: `publish/slidemaker/slides/slide_00.summary.json`
- Also available per slide: `.lint.json` and `.layout.json`

### Success criteria

Keep iterating until all three are true:
- `ok: true`
- `publish_ok: true`
- `clean_ok: true`

Do not stop at `publish_ok: true` — target `clean_ok: true`.

### Triage tips

- Use `check` for fast iteration before `publish`.
- Use `budget` before the first publish on any new deck.
- Use `repair-plan` when the next fix is unclear — always run `check` first, since `repair-plan` reads those artifacts.
- Read the `recommended_action` field on each lint issue.
- If `ok: false` with no lint issues, the slide files likely have JSON syntax errors or missing required fields — validate the JSON and check for missing `v`, `fr`, or `meta` keys.

## After publishing

Report the published deck URL and the final `ok` / `publish_ok` / `clean_ok` values. If it failed, say exactly where the process stalled.

## Project commands reference

All commands run from the skill root via `npm run`. Set `DECKS_DATA_ROOT` to control where projects live.

```bash
npm run deck-scratch -- --project-id <id> --intent "<intent>"  # scaffold new project
npm run images -- --project-root <project-dir>                  # generate refs and assets
npm run projects -- list                                        # list all projects
npm run projects -- show <project>                              # inspect a project
npm run projects -- pull <project> slidemaker                   # pull latest from hosted
npm run projects -- check <project> slidemaker                  # validate locally
npm run projects -- budget <project> slidemaker                 # check text budgets
npm run projects -- repair-plan <project> slidemaker            # get fix suggestions
npm run projects -- publish <project> slidemaker                # compile and upload
```

## References

- DSL syntax: `references/dsl.md`
- Preflight and lint issues: `references/preflight.md`
