# End-to-end validation

> Realizes PRD §8 (Verification — Manual E2E).

## What we're validating
That a real user, on a real machine with Claude Code and Codex actually installed, can go from "nothing" to "a skill authored once and working in both tools" — and then evolve, drift-check, and remove that skill — without surprises, lost work, or mystery errors.

## Scenarios to walk through
1. **First run.** Install skillsync locally. Run `skillsync new`. Walk through authoring. Confirm the skill exists in `~/.skillsync/skills/<name>/` and the API key is in the OS keychain (and only there).
2. **Dry run sync.** `skillsync sync --dry-run` shows diffs for both targets. Nothing is written.
3. **Real sync.** `skillsync sync`. Approve the prompts. The skill appears inside Claude Code's and Codex's skill directories.
4. **Cross-tool verification.** Launch Claude Code in a test directory and confirm the new skill is discoverable. Launch Codex and confirm the same.
5. **Idempotence.** Re-run `skillsync sync` — silent no-op, no prompts.
6. **Drift detection.** Hand-edit the file at Claude Code's destination. Re-run sync. skillsync warns about drift and shows the diff before asking what to do.
7. **Soft delete.** `skillsync delete <name>` — the canonical skill is gone from the list but recoverable from trash. Synced copies still exist.
8. **Prune.** `skillsync delete <name> --prune` — synced copies are removed from both tools.
9. **Listing at each stage.** `skillsync list` always reflects the current state accurately.

## Pass criteria
- Every scenario behaves as described, in order, on one machine, in one sitting.
- No step requires the user to read source code or the ledger file to understand what happened.
- No step leaves the filesystem in a confusing intermediate state if interrupted.

## What counts as a failure
- Any scenario requiring a workaround, undocumented flag, or manual file surgery.
- Any file written to a target that the user did not explicitly approve (outside `--yes`).
- Any destination silently overwritten after being hand-edited.
- Any API key appearing in a file or log.
