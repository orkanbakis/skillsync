# Task 02 — core/paths.ts + tests

## Goal
Safe path-resolution primitives. Every filesystem op in later tasks routes through this module.

## Implements
[safety.spec.md](../specs/safety.spec.md) — skill-name rules, path safety, symlink refusal, `.system/` reservation.

## Deliverables
- `src/core/paths.ts`:
  - `validateSkillName(name)` — enforces `^[a-z][a-z0-9-]{0,48}$`.
  - `canonicalRoot()` → `~/.skillsync`.
  - `canonicalSkillDir(name)` → resolved path verified under the canonical root.
  - `assertNoSymlink(path)` — `fs.lstat`-based refusal.
  - `assertUnderRoot(candidate, root)` — post-`realpath` prefix check.
  - `assertNotCodexSystem(path)` — refuses paths under `${CODEX_HOME:-~/.codex}/skills/.system/`.
- `test/paths.test.ts` covering: invalid names (`..`, absolute, empty, uppercase, overlong, leading digit/hyphen); traversal rejection; symlink refusal; `.system/` refusal via both default path and `CODEX_HOME` override.

## Acceptance
- All unit tests pass under a temp `HOME`.
- No path helper in later tasks bypasses these functions.
- Behavior per [safety.spec.md](../specs/safety.spec.md).

## Depends on
Task 01.
