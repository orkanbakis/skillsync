# Safety guarantees

> Realizes PRD §3 (API-key storage + delete behavior), §4 (Codex `.system/` guard), §6 (all security mitigations).

These are the guarantees that hold everywhere in skillsync, regardless of which command the user runs. The capability specs rely on them and don't restate them.

## Skill names
- Skill names must be lowercase letters, digits, and hyphens. They must start with a letter and are short (fits on one terminal line comfortably).
- Names like `..`, `foo/bar`, `FOO`, `my_skill`, or anything with spaces are rejected before any filesystem work happens.
- Rejection is immediate, explains the rule, and gives an example of a valid name.

## Path safety
- Nothing the user types can coerce skillsync into reading or writing outside the directories it owns (`~/.skillsync/`) or the destination directories managed by target adapters.
- If a path skillsync is about to read or write turns out to be a symlink — or sits beneath a symlinked parent — skillsync refuses and tells the user which path was refused and why.
- `~/.codex/skills/.system/` (respecting `CODEX_HOME`) is reserved for OpenAI-shipped skills. skillsync never reads, writes, or deletes inside it, and this cannot be bypassed by adversarial skill names.

## Atomic writes
- Every write — a new canonical skill, a synced file at a target, a ledger update — is all-or-nothing. A user who unplugs mid-write never sees a half-written file or directory.

## Soft delete
- Deletes move canonical skills to `~/.skillsync/trash/<name>-<timestamp>/`. skillsync never hard-deletes a canonical skill. The `--prune` flag (on `delete`) affects only synced copies at targets, not the canonical.
- Canonical directories that are symlinks are refused for deletion.

## Name consistency
- A canonical skill is considered valid only when its on-disk directory name, its internal metadata, and its `SKILL.md` frontmatter `name` all agree. Any disagreement is surfaced clearly before the user relies on the skill.

## skill.json isolation
- `skill.json` is skillsync's internal bookkeeping. It is never copied to any target — not Claude Code, not Codex, not any future target.

## API keys
- API keys are stored only in the OS keychain. They are never written to files, never printed to the terminal, never included in logs.
- There is no environment-variable or plaintext-file fallback in v1.
- If no keychain is available (e.g. headless Linux without a secret service), skillsync fails with a clear, actionable error rather than falling back.

## LLM output
- All content returned by an LLM is treated as untrusted text. It is validated against a strict schema, run through the local safety scan, and previewed to the user before anything touches disk.

## Sync authorization
- skillsync only writes to target CLIs it has actually detected on the machine.
- By default, every file write at a target is individually approved by the user.
- When a destination has drifted since the last recorded sync, skillsync warns before showing the diff so the user can decide whether to overwrite hand-edits.

## Scenarios

**Invalid name → immediate refusal**
- Given: the user provides "My-Skill" as a skill name (to any command).
- When: skillsync processes the name.
- Then: skillsync refuses with an error naming "My-Skill" and citing the naming rule; no filesystem work happens; exit code 2.

**Symlink in path → refusal**
- Given: `~/.skillsync/skills/sneaky/` is a symlink pointing to `/tmp/evil/`.
- When: any command attempts to read or write that skill.
- Then: skillsync refuses, naming the symlink path and explaining why; exit code 3.

**Codex .system/ → refusal**
- Given: a skill name or resolved path falls under `~/.codex/skills/.system/`.
- When: any command attempts to read, write, or delete there.
- Then: skillsync refuses, explaining that `.system/` is reserved for OpenAI-shipped skills; exit code 3.

**skill.json never reaches a target**
- Given: canonical skill "my-skill" contains both `SKILL.md` and `skill.json`.
- When: sync writes "my-skill" to a target.
- Then: only `SKILL.md` appears at the destination; `skill.json` is not present.

## Edge cases

- **TOCTOU on symlink check.** A path passes the lstat check, then is replaced with a symlink before the atomic rename. The check-immediately-before-rename pattern minimizes this window but cannot eliminate it without kernel-level support. This is an acknowledged residual risk.
- **Keychain entry contains garbage.** `getKey` returns a stored value that is not a valid API key. The LLM API call fails with an authentication error. skillsync should suggest the user delete and re-store the key.
- **`HOME` is unset or empty.** `os.homedir()` behavior is platform-dependent when HOME is missing. skillsync refuses to run with a clear error. Exit code 3.
- **First run — `~/.skillsync/` doesn't exist.** skillsync auto-creates `~/.skillsync/`, `~/.skillsync/skills/`, and `~/.skillsync/trash/` on first use. No user interaction needed.
- **Windows-reserved names.** Names like `con`, `prn`, `nul` are valid per the skill-name regex but reserved on Windows. v1 targets macOS and Linux only; Windows is untested and undocumented.
- **Name-consistency mismatch at read time.** A canonical skill's directory name, frontmatter name, and `skill.json` name disagree (manual tampering or a partial write from a future version). skillsync reports the mismatch clearly and refuses to use the skill until the user fixes it. Exit code 2.

## Error tone
Refusals and errors are one short sentence that names the offending input and cites the rule. See [errors.md](errors.md) for exit codes, categories, and full example messages.

## Out of scope
- A `--force` flag to bypass path, symlink, or `.system/` checks. There is none.
- Unicode / international characters in skill names (v2 conversation).
- Plaintext or env-var key storage.
- Automatic trash cleanup.

## Done when
- Every user-provided name and path in skillsync flows through the same set of guards — there is no second path-handling code path.
- Attempting traversal, symlink tricks, or touching `.system/` always produces a refusal, never a partial write.
- No API key ever appears on disk outside the OS keychain.
