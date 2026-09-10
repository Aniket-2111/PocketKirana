# CLAUDE.md — PocketKirana

Multi-app grocery delivery platform (Next.js 15 + Capacitor): web app (customer/admin/delivery/picker), three Capacitor Android apps, Firebase Cloud Functions backend.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## Docs

Payments/auth documentation lives in `docs/` (Diataxis: tutorial, how-to, reference, explanation), with `PHONEPE_INTEGRATION.md` as the onboarding overview. When changing payment routes, gateway config, session auth, or middleware, update `docs/reference-payments.md` and `docs/explanation-payment-security.md` in the same change — they are kept accurate to code on purpose.

## Testing

- Run `npm test` (vitest, node env). Tests live in `test/*.test.ts`. See TESTING.md for conventions and layers.
- 100% test coverage is the goal — tests make vibe coding safe. When writing new functions, write a corresponding test. When fixing a bug, write a regression test. When adding a conditional, test BOTH paths. Never commit code that makes existing tests fail.
