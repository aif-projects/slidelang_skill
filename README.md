# SlideLang Skill

A Claude Code plugin for creating and publishing presentation decks using SlideLang — a compact, agent-friendly slide DSL with layout validation, image generation, and hosted publishing.

This plugin ships a thin-client toolchain that calls the hosted SlideLang API for compilation, validation, and image generation. Only project scaffolding runs locally — no external repo dependency required.

## Install

### As a Claude Code plugin

```
/plugin marketplace add aif-projects/slidelang_skill
/plugin install slidelang
```

### As a standalone skill

Clone this repo and symlink into your project:

```bash
ln -s /path/to/slidelang_skill/skills/slidelang ~/.claude/skills/slidelang
```

### Setup

After installing, run from the skill root (this repo's directory):

```bash
npm install
```

## Usage

Ask naturally — the skill triggers automatically:

**Create a new deck:**
> "Create a slide deck about reinforcement learning for a university audience"

**Revise an existing deck:**
> "Update the rl-zero-to-hero deck and republish"

The skill handles the full workflow: scaffolding, planning, image generation, slide authoring, validation, and publishing.

Deck projects are stored in `./slidelang-projects/` in your working directory by default. Override with the `DECKS_DATA_ROOT` environment variable.

## License

MIT
