# Task 06 — commands/new.ts end-to-end

## Goal
Wire `skillsync new` to produce a canonical skill on disk.

## Implements
[authoring.spec.md](../specs/authoring.spec.md) — the complete flow and its acceptance criteria.

## Deliverables
- `src/commands/new.ts` — implements the flow defined in [authoring.spec.md](../specs/authoring.spec.md) (name → provider → key → LLM loop → safety pass → preview → confirm → atomic write).
- `src/ui/prompts.ts` — masked password input via `@inquirer/prompts`.
- Flags: `--name <n>`, `--provider anthropic|openai`.

## Acceptance
- Manual run with a real Anthropic key creates `~/.skillsync/skills/<name>/SKILL.md` and `skill.json`.
- Keychain entry is verifiable via `security find-generic-password -s skillsync` (macOS) or the platform equivalent.
- Behavior per [authoring.spec.md](../specs/authoring.spec.md).

## Depends on
Tasks 03, 05.
