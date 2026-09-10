# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

- **vitest** (node environment) — config in `vitest.config.ts`
- `@` resolves to the project root, so imports mirror app code: `import { x } from '@/lib/x'`

## Run tests

```bash
npm test          # run once
npx vitest run    # same thing, explicit
```

## Test layers

| Layer | What | Where | When |
|-------|------|-------|------|
| Unit | Pure functions, config helpers, mappers | `test/*.test.ts` | Always — write one per new function |
| Integration | Route handlers with stubbed fetch/DB | `test/` | For payment/auth logic |
| Smoke | Boot the dev server, hit key routes | manual / scripts | Before release |
| E2E | Real browser flows | Playwright (future) | Pre-launch |

## Conventions

- File naming: `test/<module>.test.ts` mirroring the source path (`lib/foo.ts` → `test/foo.test.ts`)
- Imports: `import { describe, expect, it } from 'vitest'`
- Style: one `describe` per exported function; test **behavior**, not implementation (`expect(cfg).toEqual({...})`, never `expect(x).toBeDefined()`)
- Setup: mutate `process.env` in `beforeEach`/`afterEach` and always clean up — env vars leak across tests otherwise
- Never import real secrets or credentials in tests; set test values explicitly

## What gets a test

- New functions: a corresponding test
- Bug fixes: a regression test encoding the exact bug condition
- Error handling: a test that triggers the error
- Conditionals (if/else, switch): tests for BOTH paths
- Never commit code that makes existing tests fail
