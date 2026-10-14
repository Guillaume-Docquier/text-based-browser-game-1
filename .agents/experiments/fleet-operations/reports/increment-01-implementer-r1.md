# Fleet Operations Increment-01 Implementer Report (r1)

## Identity and handoff status

Approved contract: .agents/experiments/fleet-operations/increments/increment-01.md, version 1. Worktree: C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1. Branch: codex/fleet-operations-experiment. Base: acde251d2fb2164eb7cd881fb55fc5f08e52d817.

Implementation work is ready for the independent tester. This report records implementer-side evidence and explicit coverage gaps; it does not certify every acceptance criterion. I did not commit, push, open a PR, change environment values, edit the approved packet/requirements, or modify the orchestrator-owned run-state. The existing run-state is dirty in the shared worktree and was not authored by me.

The implementation adds shared typed action inputs, rule-mapped fleet strength allocation and target constraints, a common evaluator for UI/API/turn resolution, durable movement bindings, turn continuations, occupied-instance locks, worker persistence/deletion, Standard movement ranges, the migration, and affected UI/docs. Parent checklist fixes included pool-ID-to-definition binding, missing submitter/continuation-owner rejection, global corrupt-journey checks, own-property input-key validation, exact API DTO expectations, and native disabled-state E2E assertions.

## Changed files

Backend:

- apps/backend/drizzle/0001_fleet-action-inputs-and-movement.sql
- apps/backend/drizzle/meta/0001_snapshot.json
- apps/backend/drizzle/meta/_journal.json
- apps/backend/src/api/gameplay/SubmittedActionTargetsDto.stub.ts
- apps/backend/src/api/gameplay/SubmittedActionTargetsDto.ts
- apps/backend/src/api/gameplay/gameplay.repository.ts
- apps/backend/src/api/gameplay/gameplay.router.integration.test.ts
- apps/backend/src/api/gameplay/gameplay.concurrency.test.ts
- apps/backend/src/api/gameplay/getPlayerView.useCase.ts
- apps/backend/src/api/gameplay/updateActionSubmission.useCase.ts
- apps/backend/src/api/types.ts
- apps/backend/src/lib/db/schema.ts
- apps/backend/src/lib/rulesets/standard/action-definitions/build-fleet.ts
- apps/backend/src/lib/rulesets/standard/action-definitions/gain-energy.ts
- apps/backend/src/lib/rulesets/standard/action-definitions/gain-fuel.ts
- apps/backend/src/lib/rulesets/standard/action-definitions/gain-influence.ts
- apps/backend/src/lib/rulesets/standard/action-definitions/gain-metal.ts
- apps/backend/src/lib/rulesets/standard/action-definitions/move-fleet.ts
- apps/backend/src/lib/rulesets/standard/action-definitions/win-the-game.ts
- apps/backend/src/tests/ConcurrencyTestApiServer.ts
- apps/backend/src/turn-processing/TurnProcessor.integration.test.ts
- apps/backend/src/turn-processing/TurnProcessor.ts
- apps/backend/src/turn-processing/turns.repository.ts

Frontend:

- apps/frontend/playwright/pages/ActionsPage.ts
- apps/frontend/playwright/pages/BasePage.ts
- apps/frontend/playwright/pages/FleetsPage.ts
- apps/frontend/playwright/specs/actions.spec.ts
- apps/frontend/playwright/specs/fleets.spec.ts
- apps/frontend/playwright/specs/readiness.spec.ts
- apps/frontend/src/features/play/components/ActionCard.tsx
- apps/frontend/src/features/play/components/ActionCard.stories.tsx
- apps/frontend/src/features/play/components/ActionSelector.tsx
- apps/frontend/src/features/play/components/TargetPicker.tsx
- apps/frontend/src/features/play/fleets/FleetsPage.stories.tsx

Shared:

- packages/shared/src/action-submission/computeAvailableActions.test.ts
- packages/shared/src/action-submission/computeAvailableActions.ts
- packages/shared/src/action-submission/evaluateActionSelection.test.ts
- packages/shared/src/action-submission/evaluateActionSelection.ts
- packages/shared/src/action-submission/validation/targets/validateTarget.ts
- packages/shared/src/action-submission/validation/validateSubmittedActions.test.ts
- packages/shared/src/action-submission/validation/validateSubmittedActions.ts
- packages/shared/src/domain/ruleset/Ruleset.stub.ts
- packages/shared/src/domain/ruleset/Ruleset.test.ts
- packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.stub.ts
- packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.ts
- packages/shared/src/domain/ruleset/action-definitions/ActionInputDefinition.ts
- packages/shared/src/domain/ruleset/action-definitions/InputTag.ts
- packages/shared/src/domain/ruleset/action-definitions/PositiveInteger.ts
- packages/shared/src/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.stub.ts
- packages/shared/src/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts
- packages/shared/src/domain/ruleset/target-definitions/AbstractTargetConstraint.ts
- packages/shared/src/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts
- packages/shared/src/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts
- packages/shared/src/domain/ruleset/target-definitions/TargetConstraint.ts
- packages/shared/src/domain/ruleset/target-definitions/TargetDefinition.ts
- packages/shared/src/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts
- packages/shared/src/domain/turns/actions/Action.stub.ts
- packages/shared/src/domain/turns/actions/Action.ts
- packages/shared/src/domain/turns/actions/SelectedInputs.ts
- packages/shared/src/domain/world/fleets/Fleet.ts
- packages/shared/src/testing/test-ruleset/TestRuleset.ts
- packages/shared/src/testing/test-ruleset/action-definitions/build-fleet.ts
- packages/shared/src/testing/test-ruleset/action-definitions/gain-energy.ts
- packages/shared/src/testing/test-ruleset/action-definitions/gain-fuel.ts
- packages/shared/src/testing/test-ruleset/action-definitions/gain-influence.ts
- packages/shared/src/testing/test-ruleset/action-definitions/gain-metal.ts
- packages/shared/src/testing/test-ruleset/action-definitions/move-fleet.ts
- packages/shared/src/testing/test-ruleset/action-definitions/win-the-game.ts
- packages/shared/src/turn-resolution/ResolvedTurnState.ts
- packages/shared/src/turn-resolution/TurnContext.ts
- packages/shared/src/turn-resolution/TurnState.ts
- packages/shared/src/turn-resolution/effects/EffectPool.ts
- packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.test.ts
- packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.ts
- packages/shared/src/turn-resolution/fleet-movement.test.ts
- packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts
- packages/shared/src/turn-resolution/resolveTurn.test.ts
- packages/shared/src/turn-resolution/resolveTurn.ts

Docs:

- docs/architecture/turn-processing.md
- docs/architecture/turn-resolution.md
- docs/game-design/systems/001-turns.md
- docs/game-design/systems/003-actions.md
- docs/game-design/systems/010-fleets.md
- docs/game-design/systems/012-movement.md
- docs/game-design/systems/015-rules-engine.md
- docs/game-design/systems/README.md
- docs/glossary.md

The increment packet, requirements, orchestrator reports, and run-state are excluded from this implementer-owned file list.

## I1-01 through I1-17 evidence map

| Criterion                            | Implementer evidence and remaining verification gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1-01 shared evaluator parity        | Shared evaluator is used by candidate selection, API submission/projection, and resolution validation. Evidence: evaluateActionSelection tests; gameplay.router.integration.test.ts exact Action DTO expectations; fleets/actions E2E. Gap: no single parity regression compares actual frontend/API/resolver adapters on the same normalized partial and complete input across alternate ruleset parameters.                                                                                                                            |
| I1-02 aggregate strength             | Shared test replaces an instance and checks 20+15 edited to 35 equals 50, then 36 is rejected at 51. Real PostgreSQL gameplay.concurrency.test.ts proves two IDs for one definition race at 30+30 yields one accepted and concurrent 20+30 both accepted; PGlite worker test asserts 20+15 leaves stationary 15 and rejects replacement 31 while retaining 20+15. Gap: cross-definition aggregation from one source is not separately asserted.                                                                                          |
| I1-03 replacement and cancellation   | Shared evaluator replacement excludes the old instance; worker integration preserves old values after rejected 31 replacement; PostgreSQL test cancels an accepted 30 before submitting 20+30. API getPlayerView tests assert selection/deselection resource restoration. Gap: the full requested 20→19/21, cancel→21 reject/20 accept, then cancel-all commitment sequence is not directly asserted for fleet strength.                                                                                                                 |
| I1-04 aggregate resources            | Shared evaluator asserts two movement reservations commit 6 Influence and 2 Fuel; API tests cover uncommitted resource display, affordability, and deselection; PostgreSQL test includes a resource-only race where just one 2-Influence build is retained from a 3-Influence budget. Gap: no dedicated assertion combines a third rejected movement with the exact mixed resource/force ledger and proves same-turn income cannot fund movement.                                                                                        |
| I1-05 dependent range                | Shared candidate test accepts an in-range destination and rejects a distant one. Browser fleet flow changes source and searches for a destination that becomes valid for that source. Gap: exact inclusive 3-4 boundary versus 3-4.001, origin no-op, and blank-source dependency cases are not all separately asserted.                                                                                                                                                                                                                 |
| I1-06 source validity                | Evaluator resolves ownership, stationary status, range, and entity type through shared constraints; UI/API/resolution use this path. Gap: focused regressions for enemy, nonexistent, wrong-game, moving, exhausted, and missing-origin sources are not individually present, especially a real other-game ID at the router seam.                                                                                                                                                                                                        |
| I1-07 input validation               | Shared evaluator tests blank input, 0, -1, fraction, NaN, Infinity, unsafe integer, excess strength, undeclared input/target tags, and inherited constructor/toString keys. API integration rejects inherited input keys. Gap: normal JSON API rejection for each numeric invalid and the valid 1/50 boundaries is not fully asserted; NaN/Infinity cannot be represented in JSON transport.                                                                                                                                             |
| I1-08 ruleset schema and composition | Ruleset tests exercise arbitrary role tags, Move+Gain composition, duplicate instances, missing/incompatible mappings, unused controls, invalid speed/range, and duplicate movement effects. Shared evaluator and fleet-movement tests execute renamed role tags. Gap: not every unsupported dependency shape/variant has an individual negative case.                                                                                                                                                                                   |
| I1-09 split departures               | fleet-movement.test.ts checks 20+15 allocations, 15 stationary remainder, permutation-stable projected children, deterministic IDs, and explicit full-source removal IDs. PGlite worker test checks the 15 remainder and two journey strengths; real PostgreSQL worker round-trip checks full-force removal of the source row and persisted inputs/movement. Gap: same-input/RNG replay through the database is not separately asserted.                                                                                                 |
| I1-10 continuation                   | Shared fleet-movement test checks speed-2 distance-5 journey advancement (remaining 3 then 1), no repeated departure payment, empty resolvedActions, and transient resolvedContinuations; worker integration persists and advances journeys. Browser lifecycle reloads and continues without a new submission. Gap: no separate test asserts every specified coincident-planet/tick-boundary variant.                                                                                                                                    |
| I1-11 occupancy lock                 | Shared evaluator rejects changing/cancelling an occupied action. PGlite API worker test checks occupied null cancellation rejection, free third instance, and rejects selecting an in-flight child while permitting the 15 stationary remainder. Browser lifecycle verifies reload lock, no cancel control, disabled occupied controls, arrival release, and source switch. Gap: direct API non-null edit and redirect attempts against the same occupied ID are not both separately covered.                                            |
| I1-12 arrival merge                  | TurnProcessor integration test asserts friendly arriving fleet merges into the existing fleet at destination. Existing fleet-build test keeps enemy fleets separate for builds, not arrivals. Gap: hostile arrival preservation (owner, ID, strength, no combat) needs a dedicated regression.                                                                                                                                                                                                                                           |
| I1-13 persistence and corruption     | Named migration/snapshot are applied by integration and PostgreSQL harnesses. Real PostgreSQL gameplay race reads persisted movement/input after worker departure and asserts full allocation removes source row. Shared resolveTurn tests reject partial journey data, missing continuation owner even with no known players, and duplicate occupancy without mutating state. Gap: corruption checks are shared-state tests, not invalid rows loaded from PostgreSQL; deterministic replay/payment/no-duplicate assertion remains open. |
| I1-14 PostgreSQL races               | Testcontainers concurrency test passes with overlapping gates: same-source 30+30 produces exactly one accepted submission; 20+30 both fit; resource-only 2+2 build race stores one; accepted departures round-trip. Gap: a distinct mixed force/resource contention boundary is not isolated from the strength race.                                                                                                                                                                                                                     |
| I1-15 close races                    | Testcontainers concurrency test overlaps action submission with readiness closure and deadline closure, verifies final turn is AWAITING_PROCESSING and all post-close writes reject. Gap: it does not force and assert both lock acquisition orders; concurrent cancellation/replacement and Ready edits are not all raced as separate cases.                                                                                                                                                                                            |
| I1-16 Standard parameters            | Standard definitions now carry speeds 0.1/1/5 and ranges 5/10/25; shared movement tests use parameterized speed and distance, and UI/API/resolution read ruleset data. Gap: explicit API/UI/resolution assertions for all three Standard tiers and the exact requested 0.5 LY/speed 2 and distinct coincident-planet timing boundaries are incomplete.                                                                                                                                                                                   |
| I1-17 browser journey                | Full serial Playwright suite and final focused fleet specs pass. The lifecycle spec enters partial force, checks valid target selection, reloads an occupied Action, advances without resubmission, verifies turn-5 arrival/release, and switches source to re-filter targets; the split flow asserts 5 stationary/5 journey strength. Gap: browser submit prevention for blank/invalid force is not directly asserted.                                                                                                                  |

The gaps above remain mandatory tester targets; none are waived by the implementation report.

## Commands and results

Final checks:

- pnpm typecheck — exit 0.
- pnpm --filter shared typecheck — exit 0.
- pnpm --filter backend typecheck — exit 0.
- pnpm --filter frontend typecheck — exit 0.
- pnpm lint — exit 0.
- pnpm format — exit 0; all 580 matched files formatted.
- git diff --check — exit 0.
- pnpm --filter shared test — exit 0, 25 files / 118 tests.
- pnpm --filter backend test --project unit — exit 0, 1 file / 5 tests.
- pnpm --filter backend test --project integration — final exit 0, 6 files / 91 tests. This project uses the repository in-memory database/PGlite.
- pnpm --filter backend test --project concurrency — final exit 0, 2 files / 4 tests using real PostgreSQL Testcontainers.
- pnpm --filter frontend build — exit 0.
- pnpm --filter frontend storybook:test — exit 0, 15 files / 49 tests.
- pnpm --filter frontend storybook:build — exit 0.
- Full Playwright with default workers: $env:PLAYWRIGHT_HTML_OPEN='never'; $env:PLAYWRIGHT_LIST_PRINT_STEPS='1'; pnpm --filter frontend e2e --add-reporter=list — exit 1, 13 passed / 8 failed; app-server cleanup completed.
- Full Playwright serial diagnostic: same command with --workers=1 — exit 0, 21 passed in 2.9 minutes; app-server cleanup completed.
- Final affected fleet rerun: $env:PLAYWRIGHT_HTML_OPEN='never'; $env:PLAYWRIGHT_LIST_PRINT_STEPS='1'; pnpm --filter frontend e2e playwright/specs/fleets.spec.ts --add-reporter=list --workers=1 — exit 0, 5 passed (three setup tests plus both fleet specs); app-server cleanup completed.

Earlier failures corrected before the final results: lint first reported test/import/style issues; the shared suite first exposed a missing Result test import; backend integration first exposed a missing TurnState runtime import; package typechecks first exposed assigning to readonly fleets and a type-only EffectError import; and formatting first reported eight modified files. Each was corrected; final listed checks pass.

## Default-parallel Playwright failure diagnostics

The initial default-worker run produced saved error contexts before the serial rerun. The two action-control errors expected aria-disabled values but the DOM rendered native disabled buttons with no aria-disabled attribute; actions.spec.ts and readiness.spec.ts now assert the native disabled state, and both pass serially. The auth test could not find the Sign in link after navigation to /; fleet and galaxy tests observed Turn 1 while waiting for Bob to show Turn 2; game creation and listing tests saw “Loading game” instead of the expected game heading; onboarding did not show “Welcome, commander”. All pass in the serial run, but the cause of those run-dependent failures is not established, so I have not labeled them infrastructure-only or treated the serial pass as proof about the default-worker run.

## Deviations and known limits

No approved-scope or environment deviations. Future arrival composition, Assault, Colonize, hostile arrival competition, history/replay UI, and unrelated new design documents remain outside this increment. The PostgreSQL concurrency evidence is explicitly separated from PGlite integration evidence. The E2E default-worker failure result remains part of the record despite the serial 21/21 pass.
