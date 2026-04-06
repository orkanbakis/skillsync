# Glossary

Terms used across the skillsync PRD, specs, and tasks. Definitions match the language of the specs — if a spec changes, this file follows.

### canonical skill
The source-of-truth skill on the user's machine, under `~/.skillsync/skills/<name>/`. Every target CLI receives a copy of this during sync.

### canonical home
`~/.skillsync/` — the root directory skillsync owns. Contains `skills/`, `trash/`, and `state.json`.

### target
An agent CLI that skillsync can sync skills to. v1: Claude Code and Codex. v2+: Cursor, Copilot, Gemini.

### target adapter
The internal module that knows how to detect one target, compute its destination for a given skill, and safely write to it. Each v1 target has its own adapter.

### destination
The path at a target where a synced skill lives — e.g. `~/.claude/skills/my-skill/` for Claude Code, `~/.codex/skills/my-skill/` for Codex.

### SKILL.md
The skill file format shared by both v1 targets: YAML frontmatter (`name`, `description`) plus a markdown body. This is the file that actually gets copied to every target.

### skill.json
skillsync's internal metadata file for each canonical skill (schema version, creation timestamp, provider/model used). Never copied to any target — now or in v2+.

### provider
An LLM vendor the user chooses during authoring — Anthropic or OpenAI in v1. The choice is per-skill.

### sync
The operation of writing canonical skill content out to every detected target, with per-file diff and user prompt.

### drift
When a destination file has been edited outside skillsync since the last recorded sync. skillsync warns about drift before showing the diff, so the user can decide whether to overwrite hand edits.

### ledger
`~/.skillsync/state.json`. Per-(skill, target) record of the last-synced content hash, destination path, and timestamp. Drives drift detection and safe `--prune`. Internal to skillsync — the user never edits it directly.

### soft delete
Deletion that moves a canonical skill to `~/.skillsync/trash/` instead of removing it. Recoverable with `mv`. This is the only kind of delete skillsync performs on canonical skills.

### trash
`~/.skillsync/trash/` — where soft-deleted canonical skills go, each under a timestamped subdirectory so repeated deletes of the same name don't collide.

### prune
On `skillsync delete <name> --prune`, the cascading removal of synced copies at every target destination. Requires a second confirmation. Does not affect the (already soft-deleted) canonical.

### write plan
The per-file list of operations an adapter intends to perform at a destination — what's new, what's changing, what's being overwritten. Shown to the user as a diff before any writes land.

### safety pass
The local scan over an LLM-authored skill body that flags dangerous patterns (fenced shell blocks, `curl | sh`, `eval`, absolute-path writes, hook-like directives). Warnings must be acknowledged before the skill can be written.
