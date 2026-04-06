# Error handling

Canonical reference for how skillsync surfaces failures: exit codes, error categories, and message tone. Other specs defer here for specifics.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (includes clean no-ops, e.g. "no targets detected") |
| 1 | User abort (Ctrl-C, "no" at a confirm, "abort" at a sync prompt) |
| 2 | Validation error (invalid skill name, invalid flag combination, skill not found, name collision) |
| 3 | Filesystem / path refused (symlink refusal, traversal attempt, `.system/`, unwritable destination, atomic-write failure) |
| 4 | LLM error (malformed response, schema validation failure, API failure, provider refusal) |
| 5 | Keychain unavailable (no OS keychain on this platform, access denied, required key missing and the user declined to provide one) |

Unexpected exceptions surface with the exit code that matches the failing area (filesystem → 3, LLM → 4, etc.), or exit code 2 when the area can't be determined.

## Categories

- **User abort.** The user decided not to proceed. Never reported as an error in the message — skillsync exits cleanly with code 1 and a neutral one-liner ("aborted").
- **Validation.** The input is wrong and the user can fix it by changing what they typed.
- **Filesystem / path.** skillsync refuses to perform the requested filesystem operation because it would violate a safety guarantee (see [safety.spec.md](safety.spec.md)).
- **LLM.** The LLM provider returned something skillsync can't use. The user can retry or abort; nothing reaches disk.
- **Keychain.** The OS keychain isn't usable in the current environment, or the user declined to provide a required key.

## Message tone

Every error message is:

- **One short sentence.** If explanation is needed, it goes on a second line, not in the first sentence.
- **Names the offending input.** "`foo/bar` isn't a valid skill name" beats "invalid name".
- **Cites the rule.** Tell the user *why*, not just *what*.
- **Suggests a fix or example where helpful.** Not required for every error, but preferred for validation failures.

No stack traces in user-facing output (logs can keep them). No exclamation marks. No apologies ("Sorry, …") — just tell the user what happened and what to do.

## Example messages by category

| Category | Example |
|---|---|
| Validation (name) | `'My Skill' isn't a valid skill name — use lowercase letters, digits, and hyphens (e.g. 'my-skill').` |
| Validation (collision) | `A skill named 'my-skill' already exists — delete it first, or choose a different name.` |
| Validation (not found) | `No skill named 'my-skill' — run 'skillsync list' to see what exists.` |
| Filesystem (symlink) | `Refusing to write through symlink '/Users/me/.claude/skills' — resolve the link or move the directory.` |
| Filesystem (.system/) | `'~/.codex/skills/.system/' is reserved for OpenAI-shipped skills and cannot be modified.` |
| Filesystem (unwritable) | `Can't write to '~/.claude/skills/my-skill/' — check directory permissions.` |
| LLM | `LLM returned malformed JSON — retry, or abort with Ctrl-C.` |
| Keychain (unavailable) | `No OS keychain available — skillsync needs a secret store to save API keys.` |
| Keychain (missing) | `No Anthropic key stored — re-run and provide one when prompted.` |
