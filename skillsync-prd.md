# skillsync — Product Requirements Document (v1)

## 1. Overview

`skillsync` is a CLI tool that lets a developer author an agent "skill" once and reuse it across multiple agent CLIs (Claude Code, Codex CLI, and later Cursor, Copilot, Gemini). Today each agent has its own skill format and storage location, forcing users to hand-port prompts/skills between tools. `skillsync` provides a single canonical source of truth and fans it out to every installed agent CLI.

### Commands

- **`skillsync new`** — LLM-guided interactive session that produces a canonical skill on disk.
- **`skillsync sync`** — detects installed agent CLIs and syncs the skill to each tool's native location.
- **`skillsync delete <name>`** — removes the canonical skill; warns about synced copies.
- **`skillsync list`** — prints canonical skills and their last-sync status per target.

---

## 2. Goals & Non-Goals

### Goals
- Single canonical skill that works, unmodified, in Claude Code and Codex CLI.
- Safe, auditable file writes (diff + confirm on every sync).
- API keys never stored in plaintext on disk.
- Extensible target adapters so v2 can add Cursor, Copilot, Gemini without refactoring the core.

### Non-Goals (v1)
- Cursor, Copilot, Gemini sync targets.
- Project-local skill sync (`./.claude/skills/`, `./.codex/skills/`).
- Skills containing executable `scripts/` — v1 only produces documentation-style skills.
- Remote/team skill sharing (everything is local-only).
- Editing an existing skill (user must `delete` and re-`new`).

---

## 3. Confirmed Decisions

| Decision | Choice |
|---|---|
| Runtime | Node.js / TypeScript, distributed via npm |
| v1 sync targets | Claude Code (`~/.claude/skills/<name>/`) + Codex CLI (`~/.codex/skills/<name>/`) |
| Skill format | SKILL.md spec (directory with `SKILL.md` — YAML frontmatter + markdown body). Verified identical across both targets via Anthropic and OpenAI official docs. |
| Authoring UX | LLM-guided conversation (user picks Anthropic or OpenAI per skill) |
| API-key storage | OS keychain only, via `@napi-rs/keyring` |
| Canonical home | `~/.skillsync/skills/<name>/` |
| Sync conflict policy | Show unified diff per file, prompt per file |
| Delete behavior | Soft-delete canonical to `~/.skillsync/trash/`; warn about synced copies; `--prune` to cascade |

---

## 4. Architecture

### 4.1 Data Model

Canonical skill directory (mirrors the SKILL.md spec used by both targets):

```
~/.skillsync/skills/<name>/
├── SKILL.md              # required: YAML frontmatter (name, description) + body
├── skill.json            # skillsync metadata: { schemaVersion, name, createdAt, llm: {provider, model} }
├── scripts/              # optional (reserved for v2; v1 author does not emit)
├── references/           # optional
└── assets/               # optional
```

`skill.json` is skillsync-internal metadata and is **never** copied to target directories.

A global sync ledger at `~/.skillsync/state.json` tracks last-synced destinations and content hashes per (skill, target) for diff detection and safe pruning.

### 4.2 Target Adapter Interface

```ts
interface TargetAdapter {
  id: "claude-code" | "codex";
  detect(): Promise<boolean>;                       // Is the CLI installed?
  destinationDir(skillName: string): string;        // Absolute path to target skill dir
  writePlan(skill: Skill): Promise<WritePlan>;      // Per-file diffs (SKILL.md, etc.)
  commit(plan: WritePlan): Promise<void>;           // Atomic per-file writes
  remove(skillName: string): Promise<void>;         // Deletes the skill dir at target
}
```

**claudeCode adapter**
- `destinationDir(name)` → `~/.claude/skills/<name>/`
- Detection: `which claude` on `PATH` OR `~/.claude/` exists

**codex adapter**
- `destinationDir(name)` → `${CODEX_HOME || ~/.codex}/skills/<name>/`
- Detection: `which codex` on `PATH` OR `~/.codex/` exists
- **Safety:** refuses to ever touch `~/.codex/skills/.system/` (reserved for OpenAI-shipped skills)

In v1, `writePlan` walks the canonical skill directory and produces one file-copy op per entry (excluding `skill.json`). No per-target rendering; the architecture keeps the door open for v2 adapters that WILL need format translation.

---

## 5. Command Flows

### 5.1 `skillsync new [--name <n>] [--provider anthropic|openai]`

1. Validate (or prompt for) skill name: `^[a-z][a-z0-9-]{0,48}$`; must not already exist in canonical home.
2. Prompt for provider; load API key from keychain (service `skillsync`, account `<provider>`). If missing, prompt (masked input) and store.
3. Start LLM-guided authoring loop: model asks clarifying questions (purpose, triggers, example inputs/outputs, edge cases) until it can emit a draft. System prompt forbids shell commands, hooks, file-execution directives, or any content beyond the declared JSON schema.
4. Model returns structured JSON `{ name, description, body }`; validated with `zod`.
5. Content-safety pass (local): warn on fenced ` ```bash/sh/zsh ` blocks, `curl | sh`, `eval`, absolute-path writes, hook-like patterns. User must acknowledge warnings.
6. Render `SKILL.md` + `skill.json` to a temp directory, show final preview, prompt confirm.
7. Atomic move to `~/.skillsync/skills/<name>/`.

### 5.2 `skillsync sync [<name>|--all] [--dry-run] [--yes]`

1. Load skill(s) from canonical home.
2. Run `detect()` for each target adapter; skip undetected targets (log which).
3. For each (skill × detected target), build a `WritePlan`: current content (if any), proposed content, unified diff.
4. Print diff; prompt `overwrite / skip / abort` per file (unless `--yes`). `--dry-run` exits after printing.
5. Commit writes atomically: write to `<dest>.skillsync.tmp`, `fs.rename` into place. Refuse to follow symlinks (`fs.lstat` check on destination parent).
6. Update `state.json` ledger with new hash + timestamp.

### 5.3 `skillsync delete <name> [--prune]`

1. Validate name; resolve `~/.skillsync/skills/<name>/` and verify prefix match post-`realpath`.
2. Confirm with user; refuse if path is a symlink.
3. Move to `~/.skillsync/trash/<name>-<timestamp>/` (soft delete, recoverable).
4. Print synced destinations from ledger; if `--prune`, remove them too via per-adapter `remove()`.
5. Update ledger.

### 5.4 `skillsync list`

Prints canonical skills + last-sync status per target (destination path, last hash, last sync timestamp, in-sync/drifted status).

---

## 6. Security

| Concern | Mitigation |
|---|---|
| Prompt injection in authoring | System prompt constrains output to strict JSON schema; content-safety pass flags dangerous patterns; mandatory human preview+confirm before any file write. |
| API-key exposure | Keychain only (`@napi-rs/keyring`); never logged; masked TTY input; no env-var fallback in v1 (documented limitation). |
| Path traversal on name | Strict regex, explicit `path.resolve` + prefix check against canonical root on every read/write. |
| Symlink attacks | `fs.lstat` checks on canonical dir, destination, and destination parent; refuse to write through symlinks. |
| Sync blast radius | Per-file diff+prompt; `--dry-run`; detection-based targeting (won't write into a tool that isn't installed); writes are atomic (tmp+rename). |
| Overwriting user edits at destinations | Ledger-tracked hash lets sync warn when the destination was modified outside skillsync since last sync. |
| TOCTOU on sync | Detect→plan→commit are separate phases; commit re-validates destination parent immediately before rename. |
| Accidental deletion | Soft-delete to `~/.skillsync/trash/`; explicit `--prune` required to remove synced copies. |
| OpenAI-shipped skills | Codex adapter refuses to read or write under `~/.codex/skills/.system/`. |
| Supply chain | Pin dependencies exactly; minimal dependency surface; skill content from LLM is treated as untrusted text, never executed. |

---

## 7. File Layout

```
skillsync/
├── package.json                 # bin: { skillsync: ./dist/cli.js }
├── tsconfig.json
├── src/
│   ├── cli.ts                   # commander entry point
│   ├── commands/
│   │   ├── new.ts
│   │   ├── sync.ts
│   │   ├── delete.ts
│   │   └── list.ts
│   ├── core/
│   │   ├── skill.ts             # canonical read/write, name validation, zod schemas
│   │   ├── author.ts            # LLM-guided authoring loop + content-safety pass
│   │   ├── ledger.ts            # state.json r/w
│   │   └── paths.ts             # safe path resolution, symlink guards
│   ├── llm/
│   │   ├── provider.ts          # common interface
│   │   ├── anthropic.ts         # @anthropic-ai/sdk
│   │   ├── openai.ts            # openai
│   │   └── prompts.ts           # system prompt + schema
│   ├── keychain.ts              # @napi-rs/keyring wrapper
│   ├── targets/
│   │   ├── index.ts             # registry + detect-all
│   │   ├── claudeCode.ts
│   │   └── codex.ts             # ~/.codex/skills adapter (+ .system/ guard)
│   └── ui/
│       ├── prompts.ts           # @inquirer/prompts wrappers, masked input
│       └── diff.ts              # unified-diff renderer
└── test/
    ├── paths.test.ts
    ├── adapters.test.ts
    ├── sync.test.ts
    └── author.test.ts
```

### Dependencies

- `commander` — CLI framework
- `@inquirer/prompts` — interactive prompts (masked password input)
- `@napi-rs/keyring` — OS keychain (maintained successor to keytar)
- `@anthropic-ai/sdk`, `openai` — LLM providers
- `zod` — schema validation of LLM output
- `diff` — unified diff generation
- `picocolors` — terminal colors
- Dev: `typescript`, `tsx`, `vitest`, `@types/node`

---

## 8. Verification

### Automated (vitest)

1. **`paths.test.ts`** — rejects `..`, absolute paths, symlinks in skill names and destinations; rejects any path under `~/.codex/skills/.system/`.
2. **`adapters.test.ts`** — `destinationDir()` resolves correctly for both adapters; Codex adapter honors `CODEX_HOME`; `detect()` flips on when fake `~/.claude` / `~/.codex` exist under a temp `HOME`.
3. **`sync.test.ts`** — set `HOME` to a temp dir, create a fake canonical skill, run `sync`, assert files written to `~/.claude/skills/<name>/SKILL.md` AND `~/.codex/skills/<name>/SKILL.md`; re-run and assert idempotence (no diffs, no prompts); modify destination and assert diff prompt fires.
4. **`author.test.ts`** — mock LLM client; assert malformed JSON is rejected; `curl | sh` in body triggers safety warning.

### Manual E2E

1. `npm run build && npm link` (or `npx .`).
2. `skillsync new` — walk through authoring with a real Anthropic key; confirm `~/.skillsync/skills/<name>/SKILL.md` exists and key is in Keychain (`security find-generic-password -s skillsync`).
3. `skillsync sync --dry-run` — confirm diffs print, no writes.
4. `skillsync sync` — accept prompts; inspect `~/.claude/skills/<name>/SKILL.md` and `~/.codex/skills/<name>/SKILL.md`.
5. Launch Claude Code in a test dir and run `/skills`; confirm the skill appears. Launch `codex` and confirm the skill is discoverable.
6. `skillsync sync` again — confirm no-op (hash match, no prompts).
7. Edit `~/.claude/skills/<name>/SKILL.md` by hand; re-run sync; confirm diff+prompt fires.
8. `skillsync delete <name>` — confirm soft-delete to trash.
9. `skillsync delete <name> --prune` — confirm destinations cleaned.

---

## 9. Implementation Order

1. Scaffold: `package.json`, `tsconfig.json`, `commander` entry, empty command stubs.
2. `core/paths.ts` + tests (foundation for everything).
3. `core/skill.ts` + zod schemas + `keychain.ts`.
4. `targets/claudeCode.ts`, `targets/codex.ts` (+ adapter tests).
5. `llm/` providers + `core/author.ts`.
6. `commands/new.ts` end-to-end.
7. `ui/diff.ts` + `commands/sync.ts` + ledger.
8. `commands/delete.ts` (+ `--prune`) + `commands/list.ts`.
9. Manual E2E pass.

---

## 10. Future (v2+)

- **Additional sync targets**: Cursor (`.cursor/rules/*.mdc`), Copilot (`.github/copilot-instructions.md`), Gemini (`~/.gemini/commands/`). Each requires a format translator since they diverge from the SKILL.md spec.
- **Project-local sync**: `skillsync sync --project <path>` to write to `.claude/skills/`, `.codex/skills/`, etc. scoped to a repo.
- **Skill editing**: `skillsync edit <name>` to launch another LLM-guided session with the existing skill as context.
- **Capability matrix**: warn/refuse when a skill uses features a target tool can't safely represent (e.g. `scripts/` on a target without scripting support).
- **Team sharing**: export/import `.skill` bundles; optional remote registry.
