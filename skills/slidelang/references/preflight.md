# Preflight and Lint Reference

## Issue kinds

| Kind | What it means |
|------|--------------|
| `page_fit` | Element exceeds slide frame |
| `text_fit_x` | Text overflows horizontally |
| `text_fit_y` | Text overflows vertically |
| `intrinsic_size_exceeds_budget` | Content exceeds budget constraints |
| `text_boundary` | Text outside its container |
| `text_overlap` | Two text nodes overlap |
| `text_clearance` | Text too close to container edge |
| `text_connector_clearance` | Text too close to a connector |
| `text_obstacle_clearance` | Text too close to an obstacle |
| `clearance_violation` | General clearance issue |
| `connector_detached` | Connector endpoint not attached to a node |
| `connector_obstacle` | Connector passes through an element |
| `module_overflow` | Module content exceeds bounds |
| `container_overflow` | Container children exceed bounds |
| `slot_overflow` | Slot content exceeds bounds |
| `density_overflow` | Text density exceeds budget |
| `export_anchor_missing` | Referenced anchor not found |
| `connector_internal_endpoint` | Connector starts/ends inside a box instead of at boundary |

## Issue fields

Every issue carries:
- `recommended_action`: what to do about it
- `auto_fixable`: whether the compiler can fix it
- `revision_required`: whether the author must intervene
- `class`: severity class
- `severity`: `"error"` or `"warn"` (editorial issues default to `"warn"`)

## Issue classes

| Class | Meaning |
|-------|---------|
| `blocking` | Must fix before publish succeeds (default gate) |
| `repairable` | Must fix for `clean_ok` |
| `editorial` | Must fix for `clean_ok` (density, container/module/slot overflow); does not block the default publish gate |

## Workflow summary fields

The fields that matter for success criteria:
- `blocking_ok`: no blocking issues remain
- `repairable_ok`: no repairable issues remain (independent of editorial issues; not the same as `clean_ok`)
- `clean_ok`: no blocking, repairable, **or editorial** issues remain
- `publish_ok`: the workflow gate is met (default gate `blocking` = no blocking issues). An empty workflow is never `publish_ok`.
- `ok`:
  - per-slide `*.summary.json`: equals `clean_ok` (slides are graded with gate `all`, so per-slide `publish_ok` also equals `clean_ok`)
  - `check` workflow summary: every slide is `blocking_ok`; the check summary has no `publish_ok` key
  - `publish` workflow summary: equals `publish_ok`

Additional detail:
- `class_counts`: `{blocking: N, repairable: N, editorial: N}`

## Common fixes

**text_fit_x / text_fit_y**: Reduce text content, increase container dimensions, lower font size, or raise `mc` budget.

**density_overflow**: Reduce text content in the container, increase container size, or adjust the density thresholds inside the budget objects — `{"ab": {"pd": 0.5}}` (parent density) or `{"rb": {"hd": 0.6}}` (hard density), or their flat forms `tdp` / `td`. A bare `pd` or `hd` opt directly on an `m`/`b` is rejected as an unsupported box option.

**text_overlap**: Move one of the overlapping text nodes, reduce their size, or restructure the layout.

**connector_detached**: The connector endpoint does not touch its node's boundary; re-anchor it (e.g., `"NODE:r"`) or move the nodes.

**Unknown node ids**: A connector ref such as `"MISSING:r"` (or a `parent` that names a missing node) does not produce an issue — it throws `Unknown anchor node: MISSING:r` and aborts the whole `check`/`publish`. Fix the id, then re-run.

**connector_internal_endpoint**: Use boundary anchors (`t b l r tl tr bl br`) instead of center or raw coordinates.

**page_fit**: Element extends beyond `[width, height]` defined in `fr`. Reduce size or reposition.

## Text node repair hints

When the compiler repositions text to fix layout issues, you can constrain it using text opts documented in `dsl.md`: `lockx`/`locky` (prevent movement), `mdx`/`mdy` (limit drift), `ra`/`ro` (repair axis / repair order: which direction and in what order the resolver may move the node).
