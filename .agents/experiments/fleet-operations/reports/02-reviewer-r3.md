# Increment 02 reviewer r3

## Verdict

**No actionable findings** in the current whole product increment diff from accepted base `e4c0710d46bb54e12946e568a7406fecf7c5ae30`, on `codex/fleet-operations-sol`, in `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`.

This is an independent review of primary code, tests, and documentation against approved increment 02 v1 (M2-01..09, A2-01..07, P2-01..06) and retained increment 01 v1 (A1-01..18). Previous implementer, tester, reviewer, orchestrator confidence reports and run-state were not read as correctness evidence. Root owns acceptance and the remaining gate ledger.

## Scope and assessment

Inspected every tracked and untracked product file under apps, packages, and docs changed from the supplied base, plus the relevant unchanged eligibility, frontend projection/TargetPicker/ActionCard, API submission/view, repository loading/saving, worker processing/availability, and fixed-phase surrounds. The exact inventory follows below. Root-owned experiment reports and run-state are outside this product review. Read the reviewer persona, requirements, both approved packets, all scoped AGENTS, TypeScript standards, glossary, installed tools-ts README, ADR index and required accepted ADRs, turn guides, GDDR009/index, and relevant Systems/index.

- Saved fleet schema, indexed pending composition, pool identity, mapped selections, owner/player/planet references, deterministic child identity, exact elapsed-turn progress, duplicate occupancy and safe whole Strength preflight run before eligibility and payment. Expected valid terminal destruction completes as Prevented; malformed saved Attack intent fails. Ordinary legacy absent lists remain supported only when the valid current definition requires no arrival effect. Saved speed remains authoritative.
- Arrival derives from canonical resulting remaining distance, with true zero tick0, positive underflow tick1, exact full-turn tick20 and final-turn rounding clamped to20. Departures precede advancement. Chronological landing and canonical same-tick merging preserve station/earliest survivor identity. Separate arrival intents preserve initiating submission, turn, effect index and tick while only actual identity redirects.
- Combat runs after all Movement and Build. Whole tied-tick groups are canonically ordered then shuffled once with the injected persisted RNG; singletons skip draws and destroyed candidates retain the predetermined schedule. Each Assault snapshots current merged survivor Strength and every positive stationed opponent, excluding friends/transit. BigInt sums/products/quotients/remainders preserve exact largest-remainder whole losses with fleet-ID ties. Zero cleanup and later destruction prevention release every original instance without rebinding an attack elsewhere.
- Factory staging excludes Assault from immediate creation, continuation does not repay, and the pool empties. Semantic initiating-turn/player/instance grouping handles reconstructed clones, repeated effect indexes, deferred deltas with no current submission, and later reuse. Engine outcomes do not claim a newly persisted history facility.
- Attack content is independently authored in Standard and Test with approved costs/speed/range. Actual frontend projection/candidate evaluation, locked API complete-set validation and resolver prevalidation use the existing shared evaluator. Editing excludes its prior reservation, cancellation releases only its own, and source changes clear dependent destinations. The two-pass singleton settling supports destination-first target declarations. No ID/name/tier-selected mechanics or parallel affordability rules were added.
- Existing game-scoped production repositories retain Turn-row locks, explicit nullable movement/destination/distance clearing, removed-ID deletion, atomic survivor/resource/next-turn writes, final RNG persistence and availability computation after resolution. Public scenario setup uses routers/actions/processing. The save-failure seam wraps the real DB transaction and aborts after awaited production writes; it is not a test repository or SQL scenario writer. Real PostgreSQL tests exercise reload, rollback/retry, Attack/Move budgets and closure/occupied-arrival races.
- Existing component/page objects/views are reused with named native API contracts. Browser combat uses literal setup/resources/distance/survivors/ownership and semantic page-object interactions. Existing Systems and guides distinguish implemented normal Assault/chronology from planned Colonization/Surprise/history. No new endpoint, migration, outcome table, Colonize placeholder, conquest or general workflow framework was introduced. The narrow intent/origin/Strength modules address real mechanics without an actionable unnecessary abstraction or harmful duplicated decision.

## Independent completed validation

All commands ran in the exact authorized checkout, using pnpm and reviewed require_escalated execution. Every command below completed with exit code 0; no partial output is reported as a completed gate.

| Command                                                                       | Actual result                                                                          |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm --filter shared test`                                                   | 24 files, 210 tests passed                                                             |
| `pnpm --filter backend test --project integration combat.integration.test.ts` | 1 file, 7 tests passed; public-router PGLite persistence/merge/Build/release           |
| `pnpm --filter backend test --project concurrency combat.concurrency.test.ts` | 1 file, 5 tests passed; real PostgreSQL Testcontainers persistence/save rollback/races |
| `pnpm --filter backend test --project unit --project types`                   | 2 files, 23 tests passed; no type errors                                               |
| `pnpm --filter frontend storybook:test`                                       | 16 files, 66 Chromium story/native tests passed                                        |
| `pnpm typecheck`                                                              | Passed                                                                                 |
| `pnpm --filter shared typecheck`                                              | Passed                                                                                 |
| `pnpm --filter backend typecheck`                                             | Passed                                                                                 |
| `pnpm --filter frontend typecheck`                                            | Passed                                                                                 |
| `pnpm lint`                                                                   | Passed                                                                                 |
| `git diff --check`                                                            | Passed                                                                                 |

Applied the repository Storybook workflow: loaded installed stories/write-story guidance, discovered component/story IDs through docs list, and read discovered ActionCard docs with source fallback for its unresolved generated frontend import. No component/story edits were made by this reviewer.

## Material limits and cleanup

I inspected the new combat E2E flow and retained movement/eligibility seams but did not rerun Playwright E2E, full backend integration/concurrency, frontend build, Storybook build, coverage or CI in this reviewer turn. Those remain separate root/tester gates; this report makes no green claim for them. Colonization04 and final Integration05 remain mandatory later increments. No static review or passing tests prove every future interaction.

Test runners completed, including owned Testcontainers/API/browser teardown. No application or Storybook server was started. Final listener inspection showed only the preserved DB on10135;10136/10137/10138 remained absent. No DB reset/reseed, environment edit, main-checkout change, SQL scenario setup, production/test/doc fix, commit, push, PR or subagent was performed. Only this report was written and formatted.

**ALL WRITING/PROCESSES STOPPED** after report formatting and final verification. Root owns acceptance/ledger.

## Complete product diff inventory

- `apps/backend/src/api/gameplay/combat.concurrency.test.ts`
- `apps/backend/src/api/gameplay/combat.integration.test.ts`
- `apps/backend/src/api/gameplay/gameplay.router.integration.test.ts`
- `apps/backend/src/api/types.ts`
- `apps/backend/src/lib/rulesets/CoreRulesets.unit.test.ts`
- `apps/backend/src/lib/rulesets/standard/action-definitions/attack-move.ts`
- `apps/backend/src/lib/rulesets/standard/StandardRuleset.ts`
- `apps/backend/src/tests/CombatActionsScenario.stub.ts`
- `apps/backend/src/tests/ConcurrencyTestApiServer.ts`
- `apps/backend/src/tests/SaveTransactionFailure.stub.ts`
- `apps/frontend/playwright/pages/FleetsPage.ts`
- `apps/frontend/playwright/specs/combat.spec.ts`
- `apps/frontend/src/features/play/components/ActionCard.stories.tsx`
- `apps/frontend/src/features/play/components/ActionCard.stub.ts`
- `apps/frontend/src/features/play/components/ActionCard.tsx`
- `apps/frontend/src/features/play/effectDefinitionToRulesText.ts`
- `docs/architecture/turn-processing.md`
- `docs/architecture/turn-resolution.md`
- `docs/game-design/systems/001-turns.md`
- `docs/game-design/systems/003-actions.md`
- `docs/game-design/systems/010-fleets.md`
- `docs/game-design/systems/011-combat.md`
- `docs/game-design/systems/012-movement.md`
- `docs/game-design/systems/015-rules-engine.md`
- `docs/game-design/systems/README.md`
- `docs/glossary.md`
- `packages/shared/src/action-submission/fleetBoundaryIndependent.test.ts`
- `packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.ts`
- `packages/shared/src/domain/ruleset/effect-definitions/AssaultEffectDefinition.stub.ts`
- `packages/shared/src/domain/ruleset/effect-definitions/AssaultEffectDefinition.ts`
- `packages/shared/src/domain/ruleset/effect-definitions/EffectDefinition.ts`
- `packages/shared/src/domain/turns/actions/ActionResolutionOrigin.ts`
- `packages/shared/src/domain/turns/actions/ResolvedAction.stub.ts`
- `packages/shared/src/domain/turns/actions/ResolvedAction.ts`
- `packages/shared/src/domain/world/fleets/Fleet.ts`
- `packages/shared/src/domain/world/fleets/FleetMovement.ts`
- `packages/shared/src/domain/world/fleets/FleetStrength.ts`
- `packages/shared/src/domain/world/fleets/PendingArrivalEffect.ts`
- `packages/shared/src/testing/test-ruleset/action-definitions/attack-move.ts`
- `packages/shared/src/testing/test-ruleset/TestRuleset.ts`
- `packages/shared/src/turn-resolution/ArrivalIntent.ts`
- `packages/shared/src/turn-resolution/effects/Effect.ts`
- `packages/shared/src/turn-resolution/effects/EffectFactory.ts`
- `packages/shared/src/turn-resolution/effects/EffectPool.test.ts`
- `packages/shared/src/turn-resolution/effects/EffectPool.ts`
- `packages/shared/src/turn-resolution/effects/implementations/AssaultEffect.ts`
- `packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.test.ts`
- `packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.ts`
- `packages/shared/src/turn-resolution/fleetOperations.test.ts`
- `packages/shared/src/turn-resolution/FleetOperationsScenario.stub.ts`
- `packages/shared/src/turn-resolution/phases/implementations/resolveFleetCombatPhase.ts`
- `packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts`
- `packages/shared/src/turn-resolution/resolveTurn.test.ts`
- `packages/shared/src/turn-resolution/resolveTurn.ts`
- `packages/shared/src/turn-resolution/state/ResolutionFleet.ts`
- `packages/shared/src/turn-resolution/TurnContext.ts`
