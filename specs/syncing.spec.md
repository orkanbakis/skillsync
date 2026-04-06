# Syncing skills to agent CLIs (`skillsync sync`)

> Realizes PRD §1 (Commands), §3 (v1 sync targets + canonical home + sync-conflict policy), §4 (target adapter interface), §5.2 (`sync` flow), §6 (sync blast radius + overwriting user edits + TOCTOU mitigations).

## What the user sees
The user runs `skillsync sync` (for one skill) or `skillsync sync --all`. skillsync reports which agent CLIs it detected on the machine and which it skipped. For each skill × target, it shows a unified diff for every file it wants to write and asks the user to approve, skip, or abort each one. With `--dry-run`, it prints and exits without writing. With `--yes`, it writes without prompting. Every successful write is recorded so the next run knows whether the destination still matches.

## Target detection
- A target counts as installed if either (a) its CLI is on `PATH`, or (b) its home directory already exists. Either signal is enough.
- **Claude Code** destination: `~/.claude/skills/<name>/`.
- **Codex** destination: `~/.codex/skills/<name>/`, or under `CODEX_HOME` if that environment variable is set.
- Before any write, skillsync lists which targets it found and which it skipped, so the user knows exactly where writes will go.
- If no targets are detected, skillsync says so plainly and exits without error.

## Flow (per skill × detected target)
1. Compare canonical content to destination content; build a diff per file.
2. If the destination drifted (see below), print a drift warning before the diff.
3. Print the unified diff.
4. Prompt per file: **overwrite / skip / abort** (unless `--yes`).
5. Write atomically — the user never sees a half-written destination file.
6. Record hash and timestamp in the ledger.

## Drift
If a destination file has been edited outside skillsync since the last recorded sync, skillsync prints "destination drifted since last sync" before the diff, so the user can decide whether to overwrite hand-edits.

## The sync ledger
skillsync keeps a small record at `~/.skillsync/state.json` of what it has written to each target. The user doesn't interact with this file directly, but its existence lets skillsync distinguish "never synced" from "drifted since last sync" from "still in sync". If the ledger is missing or corrupted, skillsync treats every destination as drifted and prompts about everything — safe by default.

## Flags
- `--dry-run` — prints diffs, exits without writing.
- `--yes` — writes without per-file prompts.
- `--all` — iterates every canonical skill; a failure on one skill doesn't stop the others, but all failures are summarized at the end.

## Behavior details
- Re-running sync immediately after a successful sync is a no-op: no diffs, no prompts, quick exit.
- Undetected targets are listed as skipped, not reported as errors.

## Scenarios

**First sync to both targets**
- Given: canonical skill "my-skill" exists; both Claude Code and Codex are detected; neither has been synced yet.
- When: user runs `skillsync sync my-skill` and approves each file.
- Then: `~/.claude/skills/my-skill/SKILL.md` and `~/.codex/skills/my-skill/SKILL.md` match the canonical content; ledger records both writes; exit code 0.

**Idempotent re-run**
- Given: "my-skill" was synced successfully; nothing has changed at any destination or in the canonical.
- When: user runs `skillsync sync my-skill`.
- Then: no diffs, no prompts; silent exit with code 0.

**Drift detection**
- Given: "my-skill" was synced to Claude Code; the user then hand-edited `~/.claude/skills/my-skill/SKILL.md`.
- When: user runs `skillsync sync my-skill`.
- Then: skillsync prints "destination drifted since last sync" before showing the diff; prompts overwrite / skip / abort.

**Dry run writes nothing**
- Given: canonical skill "my-skill" exists; both targets detected; not yet synced.
- When: user runs `skillsync sync my-skill --dry-run`.
- Then: diffs are printed for both targets; no files are written at either destination; ledger is unchanged; exit code 0.

## Edge cases

- **Destination directory not writable.** Permissions prevent writing to a target. skillsync reports the error for that target, continues to the next. Exit code 3 at the end.
- **Ledger file corrupted.** Invalid JSON or truncated `state.json`. skillsync logs a one-line warning and treats every destination as drifted (safe by default — already specified in the Drift section).
- **Extra files in the canonical directory.** v1 syncs only `SKILL.md`. Any other files the user placed alongside it (notes, drafts) are ignored during sync — no warning, no copy.
- **Two `skillsync sync` processes running simultaneously.** Not safe. skillsync does not lock the ledger. Parallel runs may produce inconsistent ledger state. This is unsupported in v1.
- **Target directory disappears between detection and commit.** Detection passed but the directory was removed before commit. skillsync reports the error for that target, continues to the next.
- **Destination path is a file instead of a directory.** skillsync refuses — a skill destination must be a directory. Exit code 3.
- **`--yes` combined with `--dry-run`.** `--dry-run` wins. Diffs are printed, nothing is written. This is the safer interpretation of contradictory flags.
- **Canonical content modified between plan and commit.** v1 does not re-read the canonical at commit time — the plan's snapshot is what gets written. This is acceptable since the user just initiated the sync.

## Out of scope
- Cursor, Copilot, Gemini targets (v2).
- Project-local sync (e.g. `./.claude/skills/` inside a repo).
- Format translation — v1 targets share the same `SKILL.md` format.
- Two-way sync (pulling destination edits back into canonical). Canonical is the source of truth.
- Partial-file merging. skillsync writes whole files or nothing.

## Done when
- First sync: the user sees diffs, approves, and the files land at every detected target.
- Second sync (no changes anywhere): completes silently with no prompts.
- User edits a destination by hand and runs sync: drift warning, then diff, then prompt.
- On a machine with only one target installed, only that target is written to.
- `--dry-run` never writes.
- `--yes` never prompts.
