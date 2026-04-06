# Task 09 — Manual E2E pass

## Goal
Walk the [e2e.spec.md](../specs/e2e.spec.md) scenarios on a real machine with Claude Code and Codex installed; document any deviation as a follow-up task.

## Implements
[e2e.spec.md](../specs/e2e.spec.md) — all nine scenarios plus its pass / failure criteria.

## Tooling reference
- Build + link locally: `npm run build && npm link` (or `npx .`).
- Verify keychain on macOS: `security find-generic-password -s skillsync`.

## Acceptance
- All nine scenarios pass per [e2e.spec.md](../specs/e2e.spec.md).
- Any deviation opens a follow-up task referencing the failing scenario.

## Depends on
Tasks 01–08.
