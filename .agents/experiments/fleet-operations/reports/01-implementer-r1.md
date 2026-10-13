# Increment 01 implementer report

Worktree: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`
Branch: `codex/fleet-operations-sol`
Base: `aa9272ec2b9ac756aa5d606bca900875ff9f58ed`
Approved contract: `increments/01-eligibility-and-allocations.md` v1.
This is implementation/self-validation evidence, not independent tester or reviewer acceptance.

## Implemented behavior

Shared declarative strength inputs, movement mappings, stationary-source and source-dependent finite-range constraints feed one structured eligibility/commitment decision. Drafts distinguish incomplete from invalid; complete submissions and candidate filtering delegate to it. Resource and strength reservations aggregate per player/source across instances, exclude the replaced instance, release on cancellation and use authoritative total stockpiles. Numeric values must be positive safe whole numbers. Unexpected selections and unsupported/malformed movement compositions fail validation.

Departure honors the selected strength once, creates deterministic children, preserves positive source remainders and removes exhausted sources. Saved journey records bind the submission, initiating Turn and speed to the child. Automatic continuation occupies that player/instance, releases on arrival/removal, preserves friendly stationed identity on merge, and leaves hostile fleets separate. The current departure effect completes without keeping a live effect-pool entry. Corrupt journey references fail; an expected later missing source produces Prevented with paid costs retained. Basic movement remains distinct from future chronological arrival/combat/colonization work.

Production API transactions serialize submissions with the existing Turn lock, validate the complete replacement set, and reject occupied edit/cancellation. API views expose real eligibility, resource/strength availability and bound IN_PROGRESS fleet/destination. Turn persistence saves selected inputs and journey JSON, clears transit fields at arrival, and deletes removed fleet rows. Migration `0001_fleet_action_inputs_and_movement.sql` and its snapshot/journal add these fields. Standard and Test content remain independent, with unchanged existing costs/speeds and explicit ranges 5/5/25; Test has a second Standard Move instance.

The frontend uses total resources/origins/submissions in its real shared-state projection. Strength edits stay local until Select/Update; invalid edits preserve remote state and keep cancellation available. Source changes clear dependent destinations. Inputs, candidate choices and messages derive from definition/state; occupied cards show the actual journey and disabled controls. Candidate evaluation reuses the normalized state once per card. Existing fleet/map views consume the persisted child/remainder state.

Documentation describes the implemented boundary and remaining planned systems. No new System/GDDR, environment values, main-checkout edits, commits, pushes or PRs were made. Orchestrator-owned packet/run-state/other reports were preserved.

## Criterion-to-evidence mapping

`S` is `packages/shared/src/action-submission/actionEligibility.test.ts` unless otherwise stated. `I` is `apps/backend/src/api/gameplay/fleetActions.integration.test.ts`; it uses public routers, production worker/repositories and ordinary resource/build actions. `C` is `fleetActions.concurrency.test.ts` on real PostgreSQL. `B` is `apps/frontend/src/features/play/components/ActionCard.stories.tsx`, using the real card/projection and controlled remote state.

| Criterion | Concrete evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1-01     | S accepts source50/X20/Y30 across different definitions; reversed20/31 returns shortfall1 at the numeric input path and resolver rejects before payment/source mutation. I saves20/30, rejects31 retaining both, and accepts Standard20 plus Improved30 with uncommittedStrength0. B CumulativeStrength selects20/30 and blocks31 without changing saved orders.                                                                                                                                             |
| A1-02     | S replacement15 commits45 with available5; cancellation removes only X and its costs. I replace15, failed31 retention, cancel X/Y and exact resource release. B ReplacementAndCancellation excludes the saved instance, blocks51 and cancels the saved submission.                                                                                                                                                                                                                                           |
| A1-03     | S resource totals6/2, aggregate shortfall1 on Influence5, separate strength/resource accounting; two departures pay6/2 once and leave0/0. C resource race allows only one of two3-Influence submissions from available5. I observes reservations and one-time continuation payment.                                                                                                                                                                                                                          |
| A1-04     | S parameter cases missing/0/-1/1.5/51/Infinity/NaN/unsafe/null/string, draft incomplete and unexpected selections. I malformed numeric/structural/tag requests reject while saved20 and source50 remain. B incomplete input and overcommit31/51 cannot submit.                                                                                                                                                                                                                                               |
| A1-05     | S enemy/missing-origin/moving/exhausted and missing targets rejected. I missing source, same-owner foreign-game fleet/planet, source-planet destination and moving child reject without changing saved order. Real UI candidates use the same predicate.                                                                                                                                                                                                                                                     |
| A1-06     | S exact(3,4), just-outside(3,4.000001), source change to(10,0), dependent destination and distinct coincident planet; no rounded-distance decision. B SourceDependentDestination clears P, permits T despite stale strength20, then selects R/10. I uses independently inspected in-range scoped planet and rejects origin/foreign targets.                                                                                                                                                                  |
| A1-07     | S renamed RENAMED/Traverse, BASIC and craft/route/force with speed2/range5; speed/range independence and malformed composition variants. Domain constructors require mapped input/source/destination and supported constraints. Backend CoreRulesets unit suite verifies independent loaded definitions. No gameplay branch by shipped ID/name/tier/tag.                                                                                                                                                     |
| A1-08     | S duplicate instance and fresh strength/resource/ownership/transit checks. Test pool supplies two Standard instances. I saves both instances, moving source rejects, busy X leaves Y available. B excludes own edited reservation and uses multiple prior orders.                                                                                                                                                                                                                                            |
| A1-09     | ActionCard/toActionEligibilityState and TargetPicker call shared selection/candidate decisions with total resources and all submitted orders. API replacement validation under lock and resolver prevalidation delegate to the same decision. B/I/S observable results above cover aggregate, malformed input, scoped source/range and current snapshots; this is not three renamed evaluator calls. O1-01 removes duplicate API occupancy logic.                                                            |
| A1-10     | S literal source50 allocations20/15 to separate distance5 destinations/speed2 leaves original15 and children20/15 at distance3; reversed submissions yield identical IDs/names/state. I proves selected20/source30 persists through production worker and repositories.                                                                                                                                                                                                                                      |
| A1-11     | S full20+30 removes source; child20 merges with own stationed7 to27 preserving ID/name, while other child30 survives separately; hostile7 remains unchanged; reordered ordinary friendly arrivals conserve50 and stable survivor. C accepted full allocation persists without zero source.                                                                                                                                                                                                                   |
| A1-12     | S exact2/2/1 journey distances3,1,arrival and JSON reload retain submission/Turn/speed; changing current definition speed to1 does not change saved2. Deterministic replay covered by split test. I uses unchanged Test speed0.1 and independently inspected initial distance1.1456435045942517:1.045643504594252 then0.9456435045942517 and arrival after12 advances, with one3/1 payment and reloaded journey equality. This is persisted continuation evidence, not a claim of literal2/2/1 API coverage. |
| A1-13     | Shared availability excludes only occupied instance, rejects stale/busy selection, releases zero-terminal/arrival. I public view IN_PROGRESS includes saved binding, edit/cancel rejects, moving child cannot source Y, reload retains lock and arrival returns X AVAILABLE. B InProgress disables inputs and shows Journey to Boundary without cancel control. E checks busy card through transit then Select action at arrival.                                                                            |
| A1-14     | S coincident distinct planet immediate arrival; malformed saved/missing references fail; unfinished movement effect is completed. FleetMoveEffect.test.ts pays costs, removes source, then asserts explanatory Prevented, retained stockpiles, empty pool and release. Illegal locked set returns INVALID_SUBMISSIONS.                                                                                                                                                                                       |
| A1-15     | C real PostgreSQL18.4, API-created source50: Promise.all30/30 has exactly one success/BAD_REQUEST and availability20;20/30 both succeed, persisted resolution conserves50/no negative source.                                                                                                                                                                                                                                                                                                                |
| A1-16     | C costly-resource competition, replacement25 versus cancellation linearization, submission versus final readiness closure, and controlled-clock deadline promotion. After-deadline probe uses always-unoccupied Y to isolate deadline rejection. Existing two lobby concurrency tests retained.                                                                                                                                                                                                              |
| A1-17     | Four real ActionCard stories cover20/30 versus31, own replacement/cancel, actual in-progress binding, and changed source/dependent target/strength. Invalid draft never calls remote submit. Full Storybook suite51 tests including native controls passes.                                                                                                                                                                                                                                                  |
| A1-18     | `apps/frontend/playwright/specs/fleets.spec.ts`: fixed-seed two-player Test, normal funding/build10, literal target56:07:50, Improved strength4. Fleet remainder6/journey4, reload, no new order, literal distances3.77/2.77/1.77/0.77/arrival across Turns4..8, busy/released instance and Fuel3 once-paid. Origin/destination galaxy links remain verified. Full E2E20 tests passes.                                                                                                                       |

## Finding dispositions

- O1-01 fixed: `isActionOccupied` takes the minimal fleet-state projection; API early rejection and shared availability reuse it. Occupied edit/cancel router coverage rerun green.
- O1-02 fixed: `getTargetOptions` receives ActionCard's existing normalized state instead of rebuilding planet/submission indexes per candidate. Full51-story gate, frontend/Storybook builds and focused/full E2E rerun green. Browser HTTP200/unselected failure was a slow-refresh assertion boundary; bounded observable wait now covers it without sleep. Diagnostic payload/view proved the saved4-strength submission and availability6 before removing logs.
- O1-03 fixed: remaining distance derives from original route length minus saved speed times elapsed journey Turns, rather than repeated subtraction. Safe initiating-Turn checks added. Literal regressions distance1/speed0.1 arrives on10;1+Number.EPSILON arrives11;Number.MIN_VALUE still arrives on1, preserving real tiny distances without a broad epsilon. Arrival Tick derives from canonical distance before the Turn. Shared93, full backend115 and full E2E20 pass after the production fix.
- Source-change story failure fixed: dependent singleton SearchSelect was disabled by its generic one-option rule. Explicit opt-in permits selecting one dependent destination; ordinary singleton behavior remains unchanged.

## Completed commands and exits

Commands ran from the assigned worktree and were followed to process exit. Final successful commands below supersede intermediate failures; no independent gate is claimed.

| Command                                                                                              | Exit / result                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter backend db:generate --name fleet_action_inputs_and_movement`                          | 0; migration/snapshot/journal generated.                                                                                                                                                                  |
| `pnpm exec oxfmt --write` with changed production/test/documentation file batches and final report   | 0; deterministic write formatting applied.                                                                                                                                                                |
| `git diff --check`                                                                                   | 0.                                                                                                                                                                                                        |
| `pnpm lint`                                                                                          | 0 after final regression cleanup.                                                                                                                                                                         |
| `pnpm typecheck`                                                                                     | 0.                                                                                                                                                                                                        |
| `pnpm --filter shared typecheck`                                                                     | 0.                                                                                                                                                                                                        |
| `pnpm --filter backend typecheck`                                                                    | 0.                                                                                                                                                                                                        |
| `pnpm --filter frontend typecheck`                                                                   | 0.                                                                                                                                                                                                        |
| `pnpm --filter shared test:coverage`                                                                 | 0;93 tests/19 files; statements89.48%,branches82.14%,functions85.31%,lines90.66%. Latest rerun includes fractional-speed and mixed-definition coverage.                                                   |
| `pnpm --filter backend test:coverage`                                                                | 0;115 tests/11 files; no type errors; unit/integration/concurrency/types projects. Statements81.82%,branches76.8%,functions90.11%,lines80.88%. Latest full run includes O1-01 and O1-03 production fixes. |
| `pnpm --filter backend test --project integration src/api/gameplay/fleetActions.integration.test.ts` | 0 for all3 tests on final foreign-game and mixed-definition test content. Subsequent lint failed on an unrelated shared test-arrange conditional, fixed by a filter/concat; final global lint/types pass. |
| `pnpm --filter frontend build`                                                                       | 0 after O1-02.                                                                                                                                                                                            |
| `pnpm --filter frontend storybook:build`                                                             | 0 after O1-02, completed output/cleanup.                                                                                                                                                                  |
| `pnpm --filter frontend storybook:test`                                                              | 0;51 tests/15 files after O1-02.                                                                                                                                                                          |
| `pnpm --filter frontend e2e fleets.spec.ts`                                                          | 0;4 including3 auth setup tests,57.5seconds, webserver cleanup complete.                                                                                                                                  |
| `pnpm --filter frontend e2e`                                                                         | 0;20 tests,1.1minutes, webserver cleanup complete. Includes all existing action/readiness/map/link flows and new partial journey. Full run began after O1-03.                                             |

Full backend includes real PostgreSQL concurrency5 fleet+2 existing lobby cases. New API setup uses ordinary routers; the controlled harness supplies production clock/worker/repositories and actual migrations. PGlite integration and real PostgreSQL concurrency are separate evidence layers. Browser runs retained normal Clerk setup and used skill-prescribed TTY; no auth/setup bypass. Test resource flags do not stand in for live decisions.

Intermediate failures were investigated rather than ignored: old exact DTO expectations needed uncommittedStrength; fixture timeout15s increased to60s for ordinary repeated builds; initial browser funding lacked Metal; API5-seat target/distance differed from browser2-player target/distance; default5s Selected assertion raced the large refreshed view; source-dependent singleton was disabled; new regression tests needed comparator/nonconditional lint cleanup; foreign-game short-deadline fixture competed with the main game's controlled worker and was changed to a day-long deadline with ordinary readiness closure. Diagnostic E2E runs ended exit1 (one was explicitly interrupted and cleanup reached exit1); they do not establish acceptance. Final runs above all completed.

Relevant warnings: Node DEP0205 in Storybook, Vite/mock-hook and bundler module-directive warnings, NO_COLOR/FORCE_COLOR and development Clerk notices, pg client-query deprecation, Vitest experimental type-test notice. No unexplained failing check remains. Git emits CRLF normalization notices for preserved/preexisting files; final diff-check is clean.

## Review surfaces and limits

Same-checkout Storybook remains running on `http://localhost:10138/`; review `http://localhost:10138/?path=/review/`. Story links: `?path=/story/application-action-card--cumulative-strength`, `--replacement-and-cancellation`, `--source-dependent-destination`, `--in-progress`. Representative screenshot: `reports/01-implementer-in-progress.png`, saved and visually inspected. Full tests determine story status rather than stale HMR badges.

No known behavioral acceptance failure remains. Coverage limits are explicit: literal distance5/speed2/2-2-1 and synthetic corrupt/exhausted/missing-origin states are shared resolver/domain fixtures, while routers prove legal scoped public state, foreign IDs, moving sources, authoritative reservations and persisted continuation using unchanged Test content. Not every synthetic invalid state was independently manufactured through every adapter; those adapters are inspectable direct shared delegations and the fresh tester owns independent coverage/gap assessment. No direct game-state database setup was added to manufacture such states. Dedicated exact timing at every arrival Tick and chronological combat/colonization/provenance remain the approved later-increment scope; this report makes no claim of them.

All implementation and self-validation are complete. Independent fresh tester/reviewer acceptance and latest-head CI remain orchestrator responsibilities. No commit/PR was made. At handoff, all code/test/document/report writes are stopped; implementer remains available for routed fixes.

## Changed file inventory

The following approved production/test/existing-doc paths are the current diff/untracked inventory relative to the base. Deleted legacy validators are included; `.agents` orchestrator artifacts are deliberately excluded. The assigned report and screenshot are listed separately above.

- `apps/backend/drizzle/0001_fleet_action_inputs_and_movement.sql`
- `apps/backend/drizzle/meta/0001_snapshot.json`
- `apps/backend/drizzle/meta/_journal.json`
- `apps/backend/src/api/gameplay/SubmittedActionTargetsDto.stub.ts`
- `apps/backend/src/api/gameplay/SubmittedActionTargetsDto.ts`
- `apps/backend/src/api/gameplay/fleetActions.concurrency.test.ts`
- `apps/backend/src/api/gameplay/fleetActions.integration.test.ts`
- `apps/backend/src/api/gameplay/gameplay.repository.ts`
- `apps/backend/src/api/gameplay/gameplay.router.integration.test.ts`
- `apps/backend/src/api/gameplay/getPlayerView.useCase.ts`
- `apps/backend/src/api/gameplay/updateActionSubmission.useCase.ts`
- `apps/backend/src/api/types.ts`
- `apps/backend/src/lib/db/schema.ts`
- `apps/backend/src/lib/rulesets/standard/action-definitions/build-fleet.ts`
- `apps/backend/src/lib/rulesets/standard/action-definitions/gain-energy.ts`
- `apps/backend/src/lib/rulesets/standard/action-definitions/gain-fuel.ts`
- `apps/backend/src/lib/rulesets/standard/action-definitions/gain-influence.ts`
- `apps/backend/src/lib/rulesets/standard/action-definitions/gain-metal.ts`
- `apps/backend/src/lib/rulesets/standard/action-definitions/move-fleet.ts`
- `apps/backend/src/lib/rulesets/standard/action-definitions/win-the-game.ts`
- `apps/backend/src/tests/ConcurrencyTestApiServer.ts`
- `apps/backend/src/tests/FleetActionsScenario.stub.ts`
- `apps/backend/src/turn-processing/TurnProcessor.integration.test.ts`
- `apps/backend/src/turn-processing/TurnProcessor.ts`
- `apps/backend/src/turn-processing/turns.repository.ts`
- `apps/frontend/playwright/pages/ActionsPage.ts`
- `apps/frontend/playwright/pages/FleetsPage.ts`
- `apps/frontend/playwright/specs/fleets.spec.ts`
- `apps/frontend/src/components/search-select.tsx`
- `apps/frontend/src/features/play/actionEligibilityState.ts`
- `apps/frontend/src/features/play/components/ActionCard.stories.tsx`
- `apps/frontend/src/features/play/components/ActionCard.stub.ts`
- `apps/frontend/src/features/play/components/ActionCard.tsx`
- `apps/frontend/src/features/play/components/ActionSelector.tsx`
- `apps/frontend/src/features/play/components/TargetPicker.tsx`
- `apps/frontend/src/features/play/fleets/FleetsPage.stories.tsx`
- `apps/frontend/src/lib/api/useUpdateActionSubmission.ts`
- `docs/architecture/turn-processing.md`
- `docs/architecture/turn-resolution.md`
- `docs/game-design/systems/001-turns.md`
- `docs/game-design/systems/003-actions.md`
- `docs/game-design/systems/010-fleets.md`
- `docs/game-design/systems/012-movement.md`
- `docs/game-design/systems/014-resources.md`
- `docs/game-design/systems/015-rules-engine.md`
- `docs/game-design/systems/README.md`
- `docs/glossary.md`
- `packages/shared/src/action-submission/actionEligibility.stub.ts`
- `packages/shared/src/action-submission/actionEligibility.test.ts`
- `packages/shared/src/action-submission/actionEligibility.ts`
- `packages/shared/src/action-submission/computeAvailableActions.test.ts`
- `packages/shared/src/action-submission/computeAvailableActions.ts`
- `packages/shared/src/action-submission/getUncommittedResources.ts`
- `packages/shared/src/action-submission/validation/SubmittedActionValidator.ts`
- `packages/shared/src/action-submission/validation/action-definition/validateActionDefinition.test.ts`
- `packages/shared/src/action-submission/validation/action-definition/validateActionDefinition.ts`
- `packages/shared/src/action-submission/validation/costs/validateCosts.test.ts`
- `packages/shared/src/action-submission/validation/costs/validateCosts.ts`
- `packages/shared/src/action-submission/validation/targets/target-constraints/TargetConstraintEvaluator.ts`
- `packages/shared/src/action-submission/validation/targets/target-constraints/evaluateOwnedBySubmittingPlayerConstraint.test.ts`
- `packages/shared/src/action-submission/validation/targets/target-constraints/evaluateOwnedBySubmittingPlayerConstraint.ts`
- `packages/shared/src/action-submission/validation/targets/validateTarget.test.ts`
- `packages/shared/src/action-submission/validation/targets/validateTarget.ts`
- `packages/shared/src/action-submission/validation/targets/validateTargets.test.ts`
- `packages/shared/src/action-submission/validation/targets/validateTargets.ts`
- `packages/shared/src/action-submission/validation/validateSubmittedActions.test.ts`
- `packages/shared/src/action-submission/validation/validateSubmittedActions.ts`
- `packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.stub.ts`
- `packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.ts`
- `packages/shared/src/domain/ruleset/action-definitions/InputDefinition.ts`
- `packages/shared/src/domain/ruleset/action-definitions/InputTag.ts`
- `packages/shared/src/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.stub.ts`
- `packages/shared/src/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts`
- `packages/shared/src/domain/ruleset/target-definitions/TargetConstraint.ts`
- `packages/shared/src/domain/ruleset/target-definitions/TargetDefinition.ts`
- `packages/shared/src/domain/turns/actions/Action.stub.ts`
- `packages/shared/src/domain/turns/actions/Action.ts`
- `packages/shared/src/domain/turns/actions/SelectedInputs.ts`
- `packages/shared/src/domain/world/fleets/Fleet.ts`
- `packages/shared/src/domain/world/fleets/FleetMovement.ts`
- `packages/shared/src/domain/world/planets/getPlanetDistance.ts`
- `packages/shared/src/testing/extractSuccess.ts`
- `packages/shared/src/testing/test-ruleset/TestRuleset.ts`
- `packages/shared/src/testing/test-ruleset/action-definitions/build-fleet.ts`
- `packages/shared/src/testing/test-ruleset/action-definitions/gain-energy.ts`
- `packages/shared/src/testing/test-ruleset/action-definitions/gain-fuel.ts`
- `packages/shared/src/testing/test-ruleset/action-definitions/gain-influence.ts`
- `packages/shared/src/testing/test-ruleset/action-definitions/gain-metal.ts`
- `packages/shared/src/testing/test-ruleset/action-definitions/move-fleet.ts`
- `packages/shared/src/testing/test-ruleset/action-definitions/win-the-game.ts`
- `packages/shared/src/turn-resolution/effects/implementations/FleetBuildEffect.ts`
- `packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.test.ts`
- `packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.ts`
- `packages/shared/src/turn-resolution/effects/resolveTargetId.ts`
- `packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts`
- `packages/shared/src/turn-resolution/resolveTurn.test.ts`
