---
schema: cto.config.md
schema_version: 1
contract_version: 1
status: draft
source_charter_version: not recorded
generated_at: 2026-07-21T19:52:44.907Z
---

# cto.config.md

This file is the canonical operating contract for the repository. Agent instruction files are generated artifacts and must stay aligned with this contract.

## Operating Scope

- Workspace: AIF
- Repository: aif-projects/slidelang_skill
- Default branch: main
- Company stage: Seed
- Team size: 3
- Review cadence: weekly
- Primary agent surfaces: Claude Code, Codex
- Generated artifact targets: AGENTS.md, CLAUDE.md

## Priorities

- speed
- alignment
- quality

## Principles

- **Surface errors immediately**: Prefer visible failures and direct remediation over silent recovery paths.
- **Test meaningful behavior before ship**: Every material change should carry tests or a documented verification path.

## Quality Gates

- Minimum meaningful test coverage target: 80%
- Maximum preferred file length: 800 lines
- Fallback patterns: warn
- Error masking: disallow
- CI tests required before merge: Yes

## Agent Context

- Keep shared instructions in unified mode.
- Refresh agent context after 21 days or material repo changes.
- Treat policy drift as warn.

## Coding Standards

- Immutability: prefer
- Maximum function length: 50 lines
- Maximum nesting depth: 4

## Ownership

| Area | Owner |
| --- | --- |
| Repository | Engineering |

## Authority

| Capability | Mode | Rationale |
| --- | --- | --- |
| Generate policy artifacts | allow | Derived artifacts may be generated from an approved operating contract. |

## Repository Memory Boundary

- Policy files: cto.config.md
- Primary languages: not specified
- Package managers: not specified
- Test commands: Use the repository's documented test command
- Critical paths: Repository-critical paths are determined by current ownership and review scope.

## Change Control

- Change this contract through review and approval.
- Treat generated agent files as compiled outputs of this contract.
- If generated files drift from this contract, regenerate them or approve the manual change into a new contract version.