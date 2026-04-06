# Task 05 — LLM providers + core/author.ts

## Goal
LLM-guided authoring loop that produces a validated, safety-scanned canonical skill.

## Implements
[authoring.spec.md](../specs/authoring.spec.md) — conversation loop, draft shape, safety pass, malformed-output handling, per-skill provider choice.

## Deliverables
- `src/llm/provider.ts` — common interface: `chat(messages, {schema}) → Promise<T>`.
- `src/llm/anthropic.ts`, `src/llm/openai.ts` — provider implementations using `@anthropic-ai/sdk` / `openai`. Pull keys via `keychain.ts`; prompt + store if absent.
- `src/llm/prompts.ts` — strict system prompt: output must be JSON `{name, description, body}` only; forbids shell commands, hooks, file-execution directives.
- `src/core/author.ts`:
  - Multi-turn clarifying loop (purpose, triggers, example I/O, edge cases) until the model emits the structured draft.
  - zod validation on the draft.
  - Content-safety pass flagging fenced `bash`/`sh`/`zsh` blocks, `curl | sh`, `eval`, absolute-path writes, hook-like patterns.
- `test/author.test.ts` (mocked LLM) covering: malformed JSON rejection; `curl | sh` in body triggers warning; fenced `bash` block triggers warning.

## Acceptance
- All author tests pass.
- No draft reaches disk without passing zod validation, the safety pass, and explicit user confirm.
- Behavior per [authoring.spec.md](../specs/authoring.spec.md).

## Depends on
Task 03.
