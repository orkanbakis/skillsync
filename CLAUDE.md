# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This repository is **pre-implementation**. The only artifact is `skillsync-prd.md` (the v1 PRD). No `package.json`, source, tests, or tooling exist yet. When asked to implement, follow the PRD's Implementation Order (§9) unless the user says otherwise.

## What skillsync Is

A Node.js/TypeScript CLI (distributed via npm, `bin: skillsync`) that maintains a single canonical agent "skill" under `~/.skillsync/skills/<name>/` and fans it out to each installed agent CLI's native skill directory. v1 targets are Claude Code (`~/.claude/skills/<name>/`) and Codex CLI (`${CODEX_HOME:-~/.codex}/skills/<name>/`). The canonical format IS the SKILL.md spec (YAML frontmatter + markdown body), which is identical across both v1 targets, so v1 does no per-target rendering — it just copies files.

## Architecture (load-bearing concepts)

- **Target adapters** (`src/targets/*.ts`) implement a common `TargetAdapter` interface: `detect()`, `destinationDir(name)`, `writePlan(skill)`, `commit(plan)`, `remove(name)`. Adding a new agent CLI in v2 means adding one adapter — the core must not know about specific targets. This is why v1 keeps `writePlan` around even though it's a trivial file copy: v2 adapters (Cursor/Copilot/Gemini) will translate formats here.
- **Sync ledger** at `~/.skillsync/state.json` records `(skill, target) → {hash, timestamp, destPath}`. It drives drift detection (warn when destination was edited outside skillsync) and safe `--prune` on delete.
- **`skill.json`** in each canonical skill dir is skillsync-internal metadata and **must never** be copied to target directories. Only `SKILL.md` (and later `references/`, `assets/`) ship to targets.
- **Three-phase sync**: detect → plan (build diffs) → commit (atomic `tmp + rename`). Phases are separate to keep TOCTOU windows small; commit re-validates the destination parent immediately before `rename`.
- **Authoring** (`src/core/author.ts` + `src/llm/`) is an LLM-guided loop that returns structured JSON `{name, description, body}` validated with zod, followed by a local content-safety pass (flags `curl | sh`, fenced shell blocks, `eval`, absolute-path writes, hook-like patterns) and a mandatory human preview+confirm before any disk write.

## Security Invariants (do not relax without discussion)

- Skill names must match `^[a-z][a-z0-9-]{0,48}$`. Every read/write does `path.resolve` + prefix-check against the canonical root, plus `fs.lstat` symlink guards on the path, destination, and destination parent.
- The Codex adapter **must refuse** to read or write under `~/.codex/skills/.system/` (reserved for OpenAI-shipped skills).
- API keys live in the OS keychain only via `@napi-rs/keyring` (service `skillsync`, account `<provider>`). No env-var fallback in v1. Never log keys; use masked TTY input.
- Delete is soft by default (move to `~/.skillsync/trash/<name>-<timestamp>/`). Synced copies are only removed when the user passes `--prune`.
- LLM output is untrusted text: validate with zod, run the safety pass, never execute.

## Pinned Stack (from PRD §7)

`commander`, `@inquirer/prompts`, `@napi-rs/keyring`, `@anthropic-ai/sdk`, `openai`, `zod`, `diff`, `picocolors`. Dev: `typescript`, `tsx`, `vitest`. Pin exact versions — minimal dependency surface is an explicit security goal.

## Testing Approach

Tests use `vitest` and run against a temp `HOME` so adapter detection and sync writes land in a sandbox. The four required suites (PRD §8) are `paths.test.ts`, `adapters.test.ts`, `sync.test.ts`, `author.test.ts`. The sync test must cover idempotence (second run = no diffs, no prompts) and drift (hand-editing a destination triggers the diff prompt).

## Out of Scope for v1

Don't add: Cursor/Copilot/Gemini adapters, project-local sync (`./.claude/skills/`), executable `scripts/` in skills, skill editing (`delete` + re-`new` is the workflow), or any remote/team sharing. These are all v2+ (PRD §10).
