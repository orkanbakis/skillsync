# Task 04 — target adapters (claudeCode, codex) + tests

## Goal
Implement the two v1 sync targets behind the `TargetAdapter` interface (PRD §4.2).

## Implements
[syncing.spec.md](../specs/syncing.spec.md) — detection, destinations, `CODEX_HOME` honoring.
[safety.spec.md](../specs/safety.spec.md) — `.system/` reservation, `skill.json` isolation.

## Deliverables
- `src/targets/index.ts` — adapter registry + `detectAll()`.
- `src/targets/claudeCode.ts`:
  - `destinationDir(name)` → `~/.claude/skills/<name>/`.
  - `detect()` → `which claude` on PATH OR `~/.claude/` exists.
- `src/targets/codex.ts`:
  - `destinationDir(name)` → `${CODEX_HOME || ~/.codex}/skills/<name>/`.
  - `detect()` → `which codex` on PATH OR `~/.codex/` exists.
  - Every path op runs `assertNotCodexSystem`.
- Both adapters implement `writePlan(skill)` (walks canonical dir, skips `skill.json`, emits per-file diffs) and `commit(plan)` (tmp + rename, symlink check immediately before rename).
- `test/adapters.test.ts` covering: `destinationDir` correctness; `CODEX_HOME` override; `detect()` toggling on fake HOMEs; Codex refusal to touch `.system/`.

## Acceptance
- Adapter tests pass.
- No adapter can reach outside its own `destinationDir(name)`.
- Behavior per [syncing.spec.md](../specs/syncing.spec.md) and [safety.spec.md](../specs/safety.spec.md).

## Depends on
Task 03.
