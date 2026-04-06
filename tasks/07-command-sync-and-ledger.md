# Task 07 — ui/diff.ts + commands/sync.ts + ledger

## Goal
Fan canonical skills out to detected targets with per-file diff + prompt, backed by a hash ledger.

## Implements
[syncing.spec.md](../specs/syncing.spec.md) — detection, diffs, drift, prompts, `--dry-run`, `--yes`, `--all`, idempotence, ledger.

## Deliverables
- `src/ui/diff.ts` — unified-diff renderer using `diff` + `picocolors`.
- `src/core/ledger.ts` — read/write `~/.skillsync/state.json`. Shape: `{[skillName]: {[targetId]: {destPath, hash, syncedAt}}}`.
- `src/commands/sync.ts`:
  - Args: `[<name>|--all]`, flags `--dry-run`, `--yes`.
  - Loads skill(s); `detectAll()`; logs skipped targets; builds a `WritePlan` per (skill × target); prints diffs (with drift warning when ledger hash ≠ destination hash); prompts per file unless `--yes`; commits atomically (`.skillsync.tmp` + lstat-check parent + `fs.rename`); updates ledger.
- `test/sync.test.ts` under a temp `HOME` covering: fresh sync writes to both targets; re-run is idempotent; hand-edited destination triggers drift warning + diff prompt; `--dry-run` writes nothing; undetected target is skipped.

## Acceptance
- All sync tests pass.
- No destination file is written without passing the symlink check immediately before rename.
- Behavior per [syncing.spec.md](../specs/syncing.spec.md).

## Depends on
Task 04.
