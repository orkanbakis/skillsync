# Specs

Plain-language behavior specs for skillsync v1. Each spec answers: *what does the user see, and what should happen?* — no code, no types, no algorithms.

Specs are organized by **user capability**, not by implementation order.

## Capability specs

| Spec | Covers |
|---|---|
| [authoring](authoring.spec.md) | Creating a new skill — `skillsync new` |
| [syncing](syncing.spec.md) | Fanning skills out to agent CLIs — `skillsync sync` |
| [managing](managing.spec.md) | Listing and deleting skills — `skillsync list`, `skillsync delete` |
| [safety](safety.spec.md) | Cross-cutting guarantees that hold everywhere |
| [e2e](e2e.spec.md) | End-to-end validation scenarios |

## Reference
- [glossary.md](glossary.md) — terms used across all specs, PRD, and tasks
- [errors.md](errors.md) — exit codes, error categories, and message tone

## Related documents
- Product scope and locked decisions: [`../skillsync-prd.md`](../skillsync-prd.md)
- Execution plan: [`../tasks/`](../tasks/)
