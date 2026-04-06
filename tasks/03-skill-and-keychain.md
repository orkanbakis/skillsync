# Task 03 — core/skill.ts + zod schemas + keychain.ts

## Goal
Canonical-skill read/write and OS-keychain wrapper.

## Implements
[safety.spec.md](../specs/safety.spec.md) — atomic writes, name consistency, `skill.json` isolation, API-key storage.
[authoring.spec.md](../specs/authoring.spec.md) — key prompt/storage UX.

## Deliverables
- `src/core/skill.ts`:
  - zod schemas for `SKILL.md` frontmatter (`name`, `description`) and `skill.json` (`{schemaVersion, name, createdAt, llm: {provider, model}}`).
  - `readSkill(name)`, `writeSkill(skill)` (atomic: temp dir + `fs.rename`), `listSkills()`, `softDeleteSkill(name)` (→ `~/.skillsync/trash/<name>-<timestamp>/`).
  - A separate accessor that exposes only target-bound content — `skill.json` is never returned from it.
  - All filesystem ops go through `core/paths.ts` guards.
- `src/keychain.ts`:
  - `getKey(provider)`, `setKey(provider, value)`, `deleteKey(provider)` via `@napi-rs/keyring` (service `skillsync`, account `<provider>`).
  - Never logs the key; returns `null` when absent.

## Acceptance
- `writeSkill` → `readSkill` round-trips equal content.
- Malformed frontmatter → zod error with a clear message.
- `skill.json` cannot be retrieved through the target-bound accessor.
- Behavior per [safety.spec.md](../specs/safety.spec.md) and [authoring.spec.md](../specs/authoring.spec.md).

## Depends on
Task 02.
