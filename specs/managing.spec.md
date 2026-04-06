# Listing and deleting skills (`skillsync list`, `skillsync delete`)

> Realizes PRD §1 (Commands), §3 (delete behavior), §5.3 (`delete` flow), §5.4 (`list` flow), §6 (accidental-deletion mitigation).

## `skillsync list`

### What the user sees
Running `skillsync list` prints one row per canonical skill: the skill name, a short description, and per-target status. Status is one of: **in sync**, **drifted**, **never synced**, or **target not installed**. Each row also shows when the skill was last synced to that target, if ever.

### Behavior
- Read-only: never writes, never prompts, never calls the network.
- Output fits on a terminal of typical width.
- If there are no canonical skills yet, prints a one-line hint pointing at `skillsync new`.

## `skillsync delete <name>`

### What the user sees
Running `skillsync delete my-skill` shows where the canonical skill lives and lists every target destination it has ever been synced to. skillsync asks for confirmation. On confirmation, the canonical skill moves to `~/.skillsync/trash/<name>-<timestamp>/` (recoverable with a simple `mv`). Synced copies at targets are left alone by default. Adding `--prune` removes them too, after a second confirmation.

### Behavior
- Soft delete is the default and cannot be accidentally escalated to hard delete. (See the [safety spec](safety.spec.md).)
- Trash entries are timestamped so repeated deletes of the same name don't collide.
- Deleting a skill that doesn't exist is an error with a clear message, not a silent success.
- Deleting a canonical directory that is a symlink is refused.
- `--prune` enumerates every destination it plans to touch and asks for a second, explicit confirmation before removing any files from targets.

## Scenarios

**List with mixed status**
- Given: two canonical skills exist — "code-review" was synced and is still in sync; "linter" was never synced.
- When: user runs `skillsync list`.
- Then: "code-review" shows status **in sync** with a last-synced timestamp; "linter" shows **never synced**; exit code 0.

**Empty list**
- Given: no canonical skills exist.
- When: user runs `skillsync list`.
- Then: output is a one-line hint pointing at `skillsync new`; exit code 0.

**Soft delete preserves synced copies**
- Given: canonical skill "old-skill" exists and was synced to Claude Code.
- When: user runs `skillsync delete old-skill` and confirms.
- Then: `~/.skillsync/skills/old-skill/` no longer exists; `~/.skillsync/trash/old-skill-<timestamp>/` contains the skill; `~/.claude/skills/old-skill/` is untouched; exit code 0.

**Prune cascades to targets**
- Given: canonical skill "old-skill" exists and was synced to both targets.
- When: user runs `skillsync delete old-skill --prune` and confirms both prompts.
- Then: canonical is in trash; `~/.claude/skills/old-skill/` and `~/.codex/skills/old-skill/` are removed; ledger entries for "old-skill" are cleared; exit code 0.

## Edge cases

- **Trash collision (same name, same second).** Two deletes of the same skill name within the same timestamp. The trash path should include sub-second precision or a short nonce to avoid collision.
- **Prune target already missing.** The ledger says a skill was synced to a target, but the destination is already gone (user deleted it manually). Prune treats "already missing" as success — idempotent, not an error.
- **List with a corrupted canonical skill.** A skill directory exists but its files are unreadable or malformed. `list` shows the skill with a warning indicator rather than crashing. Other skills still display normally.
- **Delete during an in-progress sync.** Not safe. skillsync does not lock between commands. Running delete while sync is mid-write is unsupported in v1.
- **Hundreds of canonical skills.** `list` iterates sequentially; no pagination in v1. Output may be long on a small terminal. Acceptable for v1.

## Out of scope
- Bulk delete, filtering, sorting flags.
- Machine-readable output (`--json`) for `list` — v2 conversation.
- Rename.
- Automatic trash cleanup.

## Done when
- A user can delete a skill, see every destination it was ever synced to, and optionally prune those copies — all without ever losing the canonical copy irretrievably.
- A user can run `list` and immediately understand what exists, what's synced, and what's drifted, without reading source code or the ledger file.
