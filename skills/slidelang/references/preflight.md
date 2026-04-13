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
- `severity`: numeric severity

## Issue classes

| Class | Meaning |
|-------|---------|
| `blocking` | Must fix before publish succeeds |
| `repairable` | Should fix for clean output |
| `editorial` | Optional quality improvement |

## Workflow summary fields

The three fields that matter for success criteria:
- `ok`: basic compilation succeeded
- `publish_ok`: no blocking issues remain (`blocking_ok` is an alias)
- `clean_ok`: no blocking or repairable issues remain (`repairable_ok` is an alias)

Additional detail:
- `class_counts`: `{blocking: N, repairable: N, editorial: N}`

## Common fixes

**text_fit_x / text_fit_y**: Reduce text content, increase container dimensions, lower font size, or raise `mc` budget.

**density_overflow**: Reduce text content in the container, increase container size, or adjust `pd`/`hd` thresholds.

**text_overlap**: Move one of the overlapping text nodes, reduce their size, or restructure the layout.

**connector_detached**: Ensure both endpoints reference valid node IDs with valid anchor points (e.g., `"NODE:r"` not `"MISSING:r"`).

**connector_internal_endpoint**: Use boundary anchors (`t b l r tl tr bl br`) instead of center or raw coordinates.

**page_fit**: Element extends beyond `[width, height]` defined in `fr`. Reduce size or reposition.

## Text node repair hints

When the compiler repositions text to fix layout issues, you can constrain it using text opts documented in `dsl.md`: `lockx`/`locky` (prevent movement), `mdx`/`mdy` (limit drift), `ra`/`ro` (rotation).
