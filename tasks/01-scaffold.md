# Task 01 — Scaffold

## Goal
Stand up a buildable TypeScript CLI project with `skillsync` as the bin entry and empty command stubs wired through commander.

## Implements
Foundational — no user-facing spec. Unblocks every later task.

## Deliverables
- `package.json` with `"bin": { "skillsync": "./dist/cli.js" }`, exact-pinned deps from PRD §7.
- `tsconfig.json` (Node16/NodeNext module resolution, `outDir: dist`, strict mode).
- `src/cli.ts` — commander entry registering `new`, `sync`, `delete`, `list`.
- `src/commands/{new,sync,delete,list}.ts` — stubs that print "not implemented".

## Dependencies (exact-pin)
Runtime: `commander`, `@inquirer/prompts`, `@napi-rs/keyring`, `@anthropic-ai/sdk`, `openai`, `zod`, `diff`, `picocolors`.
Dev: `typescript`, `tsx`, `vitest`, `@types/node`, `@types/diff`.

## Acceptance
- `npm run build` succeeds.
- `npm link && skillsync --help` prints all four subcommands.
- `npm test` runs (empty pass is fine).

## Depends on
None.
