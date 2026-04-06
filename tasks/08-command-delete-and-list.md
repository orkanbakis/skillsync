# Task 08 — commands/delete.ts (+ --prune) + commands/list.ts

## Goal
Safe removal and status inspection.

## Implements
[managing.spec.md](../specs/managing.spec.md) — `list` rows and status, `delete` flow, `--prune` cascade, symlink refusal.

## Deliverables
- `src/commands/delete.ts`:
  - Validate name; resolve canonical dir; verify prefix-match post-`realpath`; refuse symlinks.
  - Confirm → soft-delete to `~/.skillsync/trash/<name>-<timestamp>/`.
  - Print synced destinations from ledger; `--prune` cascades via each adapter's `remove()` after a second confirmation.
  - Update ledger (remove entries for the deleted skill).
- `src/commands/list.ts`:
  - Enumerate canonical skills; per (skill × target) print `destPath`, short hash, last sync time, and status (in-sync / drifted / never-synced / target-not-installed).

## Acceptance
- Delete moves the dir to trash; never hard-deletes without `--prune`.
- Delete refuses symlinked canonical dirs.
- `list` shows drifted status when a destination was edited outside skillsync.
- Behavior per [managing.spec.md](../specs/managing.spec.md).

## Depends on
Task 07.
