# Tasks

Implementation plan for skillsync v1, broken out from `skillsync-prd.md` §9.

Execute in order. Each task lists its `Depends on` line for parallelism opportunities (Tasks 04 and 05 can run in parallel after Task 03).

| # | Task | Depends on |
|---|---|---|
| 01 | Scaffold | — |
| 02 | core/paths.ts + tests | 01 |
| 03 | core/skill.ts + zod + keychain | 02 |
| 04 | target adapters + tests | 03 |
| 05 | LLM providers + author | 03 |
| 06 | commands/new.ts E2E | 03, 05 |
| 07 | ui/diff + commands/sync + ledger | 04 |
| 08 | commands/delete + commands/list | 07 |
| 09 | Manual E2E pass | 01–08 |
