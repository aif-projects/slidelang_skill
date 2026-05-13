---
name: slidelang
description: Create, revise, and publish presentation decks using SlideLang. Trigger when asked to make a slide deck, presentation, or slides about any topic, or to update/republish an existing SlideLang deck.
---

# SlideLang

Use this skill to create new presentation decks or revise existing ones using the SlideLang DSL.

## Required first step

Before planning, authoring, editing, generating images, or publishing, update the skill and read the current guide from the skill root. If dependencies are not installed yet, run `npm install` first.

```bash
cd <skill-root> && npm run self-update && npm run guide
```

`<skill-root>` is the directory containing this skill's `package.json`, two levels above `skills/slidelang/`.

Follow the guide printed by `npm run guide` for the rest of the workflow. The static `SKILL.md` is intentionally only a bootstrap so older installed skills do not keep stale authoring instructions.

## Running commands

All SlideLang commands run from the skill root. Use `DECKS_DATA_ROOT` to control where deck projects are stored; if unset, projects default to `./slidelang-projects/` relative to the current working directory.

```bash
DECKS_DATA_ROOT=/path/to/user/project/slidelang-projects npm run --prefix <skill-root> <command> -- <args>
```
