# Increment04 independent tester r1

Current-diff test gate: **PASS**. No production bug was demonstrated. All requested local gates completed with exit0. This is a test review, not an architecture review or increment acceptance decision.

## Identity and independent inputs

- Checkout: C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1.
- Branch: codex/fleet-operations-sol; exact base/HEAD53db264ccba9bcbed12f31d50e0ec1536f928477.
- Immutable packet04 v1 SHA256: AFF138F9792C7004AE8BF57C868B4851C0908DC4FFB7D06CDFF50E234E9478EE, independently verified.
- Read primary requirements, initial-plan, increment-template, accepted01/02/04 packets, fleet-tester persona, actual root/shared/backend/frontend/Playwright/docs instructions, coding standards/glossary/tools-ts README, specified accepted ADRs/index, turn guides, GDDR009/index, Systems001/003/008/010/011/012/014/015/index. Read installed Storybook stories/write-story guidance and announced Storybook/run-e2e-tests workflows.
- Did not read implementer/tester/reviewer confidence reports or run-state conclusions. Root mentioned a separate documentation finding after test work started; documentation was preserved and that finding is outside this verdict.

## Reviewed scope and changes

Inspected tracked test/support delta from exact base and all untracked increment tests/support: shared ColonizationScenario/colonization tests; backend colonization integration/concurrency and ColonizationActionsScenario; tracked Gameplay router/CoreRulesets tests/CombatActionsScenario/ConcurrencyTestApiServer; frontend ActionCard stories/stub, Fleets stories and colonization E2E. Inspected retained shared eligibility/Fleet Operations scenarios and public fleet/combat tests for criterion evidence. Read public production entry points and interfaces as needed to assess actual seams; made no production edits.

Tester writes are limited to packages/shared/src/turn-resolution/colonization.test.ts and this report:

1. Friendly20+20 merge tests now assert exact originating submissions (including selections), initiatingTurn1, first Tick1 order success and second Tick2 order claimed prevention, alongside40→20 and station7+40→27. Before, a wrong winning origin could leave the same final force and pass.
2. Added standalone stationary19 rejection: InvalidSubmissions threshold reason, entire pre-state unchanged, RNG1234 unchanged.
3. Added standalone stationary20 success: source deletion, exact original action/payment+claim outcomes, owner replacement preserving attributes, Influence75/Fuel100/Colony0, and unchanged RNG. This detects subtracting its own reservation twice, accidental journey/name draw or duplicate consumption.
4. Replaced calculated stationary fixture allocations with independent contract literals20+30/reject31 and25+25/reject26.

No canonical Standard/Test content, components, contracts, documentation, plans, ledger, environment values or main checkout changed. No commit/push/PR/subagents.

## Setup, assertion and isolation assessment

Shared synthetic geometry is confined to valid parsed stubs. Saved child identities originate in genuine earlier resolutions; UUID owner ordering and fixed seeded winner/RNG literals are explicit. Schema corruption tests have valid reconstructed controls and require typed failure before mutation. Public fixtures create/join/start through real routers and fund/build/travel with normal actions; their generated seed1234 target and exact7.77754335587613/7.703963225688675 observations match packet literals. Secret Turn RNG is never inferred from map seed.

API slices exercise real routers/use cases/production repositories and production processors. Custom definitions are persisted before game creation through RulesetsRepository; no SQL scenario writes, fake test repositories, private use-case calls, geometry replacement or hidden resource funding. Concrete claim/load/reset and read-only worker persistence observations are limited to the approved replay/rollback seam. SaveTransactionFailure aborts the actual transaction after awaited next-action writes, and rollback assertions include owner/Fleet/resources/actions/current RNG/next Turn/queue. Second-game same-ID comparison proves game scoping.

Real-PG simultaneous requests use Promise.allSettled, exercise Turn locks and committed sets, and accept the two legitimate serialization outcomes. ControlledClock is used without a sleep oracle. PGlite integration resources and real-PG containers/API instances use owned disposal. Storybook uses controlled state and actual shared frontend projections/ActionCard/TargetPicker. E2E interactions/selectors remain POM-owned with user-level assertions in specs. Broad Result matchers are paired with exact observable strengths/owners/resources/provenance; the added merge assertions close the identified origin-precision gap. No meaningful assertion was weakened or skipped.

## Increment04 evidence mapping

S=shared colonization.test.ts; I=backend colonization.integration.test.ts; C=colonization.concurrency.test.ts; B=ActionCard/Fleets stories and native TargetPicker tests; E=colonization.spec.ts.

| Criterion | Independently inspected observable evidence                                                                                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C4-01     | S initial19/configured24 rejected without mutation;20/21/35→0/1/15; I normal source40 literal setup and real reload; C exact20 deletion/21 null-clearing; B19/20/35.                                                                                            |
| C4-02     | S reversed three-effect list35 versus16→19/prevention and35→both deleted; I normal public defender16/35 staging and composed arrival; indexed deferred Combat then Colonize once.                                                                               |
| C4-03     | S/I no-Assault own15/enemy16, owner claim; S claimed own/enemy initial rejection; retained Attack ownership unchanged.                                                                                                                                          |
| C4-04     | S saved earliest19/terminal0 prevents while later35 wins15 and third35 preserved; reversed state and unchanged singleton RNG; stationary damaged/dead Tick0 equivalents.                                                                                        |
| C4-05     | S canonical a,b,c seeded c,b,a, state3663132860/null, invalid fourth excluded, P<Q literal b,a then c,d, reverse reconstruction; C secret-RNG immutable replay.                                                                                                 |
| C4-06     | Strengthened S exact original Tick1 winner/Tick2 prevention,20+20→20 and station7→27, early20+ordinary15→15; I normal two20 arrivals40→20/both instances released.                                                                                              |
| C4-07     | S20+30/31,35+15/16, two stationary reservations40+10/11, own20 direct success, replace/cancel/source shift, Tick0 priority and damage/death; C public50 actual races/replacement/cancel/closure; B stationary budget/source clearing.                           |
| C4-08     | S configured25 consumption and literal25+25/26; I pregame renamed Expand/Establish mappings24 rejection25 deletion35→10/source50 budgets; B configured moving/stationary25.                                                                                     |
| C4-09     | S ownership/location/schema/mapping/input/source dependency checks plus retained eligibility boundaries; actual native projection/candidate tests, B invalid edit/source clearing; I renamed content and public composed/no-Assault controls.                   |
| C4-10     | S5/speed2→3/1/0 reload, original initiatingTurn4/outcome only once, three-effect indexes0/1, zero terminal, corrupted missing/duplicate/index/variant/requirement/mapping/player/planet/child/progress/strength failure controls; C durable loader/save replay. |
| P4-01     | I shared public fixture funded7/7/1 then40/29/3/1/0/T8; retained combat fixture19 atT6; E all normal UI funding/builds/readiness.                                                                                                                               |
| P4-02     | I20/21/35 real reload/one pending/origin/deferred loss/owner/attributes/release/resources; C real-PG35 rollback/retry and20/21 clearing/deletion; idle state stable.                                                                                            |
| P4-03     | I/C staggered saved journeys claimed enroute, loser35/right15/no return/cost once; both views/null-cleared persisted state; E exact7.78/7.70/destination survivors/origin5.                                                                                     |
| P4-04     | C public stationary50 normal Attack travel/fuel funding, simultaneous20+30 accepted and20+31 one rejected shortfall1, edit/cancel/readiness/deadline and exact final2/0/4/0; configured I variant.                                                              |
| P4-05     | C two real saved35 journeys, secret-RNG replay/reversed reconstruction, committed final RNG/owner/winner15/loser35/release/4 resources; fixed shared literal tie oracle supplies independence.                                                                  |
| P4-06     | C actual save rollback after awaited statements, hidden persisted state unchanged except claim, reset/retry once, second same-map game unchanged, next Actions/Turn/queue/RNG and null clearing.                                                                |
| P4-07     | E entire public funding flow; actual owner username on accessible map/Owned planets table, reload,7.78/7.70,15/35/origin5/dash/transit release/resource-disabled originals.                                                                                     |
| P4-08     | B ColonizeThreshold/Configured25/StationaryColonize/Candidates/Budget/StationaryConfigured25 and Fleets ColonizationSurvivors; native candidate/projection tests and full E ownership/markers.                                                                  |

## Retained acceptance evidence

Retained shared actionEligibility.test.ts (AE), fleetOperations.test.ts (FO), frontend ActionCard stories/native TargetPicker (B), fleetActions/combat integration (I), fleetActions/combat concurrency (C), actions/fleets/combat E2E (E) all ran in their full appropriate suites.

| Criteria            | Concrete retained evidence                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1-01, A1-02, A1-03 | AE20+30/31, replacement15/cancel exact reservations/costs and aggregate resource shortfall; I saved invalid edits/cancellation; B cumulative strength.                         |
| A1-04, A1-05        | AE malformed numeric complete/draft/missing/exhausted/enemy/moving/origin; I raw transport/foreign-game entity rejection; native picker filtering.                             |
| A1-06, A1-07        | AE exact5/just-outside/source switch/coincident distinct IDs and renamed speed/range/schema integrity; native source selection despite stale drafts and B dependency clearing. |
| A1-08, A1-09        | AE duplicate instance/fresh owner/transit/resources; actual I public set validation and B/native frontend projection decisions, independent second instance.                   |
| A1-10, A1-11        | AE split20+15 from50/conservation/deterministic children/full allocation/station7 and hostile separation; I source50 lifecycle.                                                |
| A1-12, A1-13, A1-14 | AE2/2/1 saved speed/reload/lock/release/coincident route/terminal and corruption; I occupied old/current requests and automatic continuation; B in-progress and E reload.      |
| A1-15, A1-16        | C30/30 one and20/30 both, resource race, replacement/cancel, readiness/deadline locks with actual PG.                                                                          |
| A1-17, A1-18        | B cumulative/edit/cancel/dependency/in-progress; E actions/fleets partial4/remainder6/map/links/continuation/release/payment.                                                  |
| M2-01, M2-02        | FO actual zero/MIN_VALUE/full20 attack order,5/speed2 final10,0.11/0.19 tick2 versus0.21 tick3, tenth0.01 turn20.                                                              |
| M2-03, M2-04        | FO earliest chronological/canonical child and stationed identities; late ordinary enemy arrivals and same-turn Build before Combat.                                            |
| M2-05, M2-06        | FO source50 ordinary20/Attack15 reload; station7+20+10→37/combat25, separate original ticks2/19 and two Assaults on survivor.                                                  |
| M2-07, M2-08        | FO deferred empty-pool/no payment/attack until arrival, initiatingTurn4/no-current-submission/JSON regrouping and reuse identity.                                              |
| M2-09               | FO genuine terminal0/dead pending Prevented, malformed pending/binding/progress/player/planet/nonwhole failure, legacy ordinary pending absent and saved speed change.         |
| A2-01, A2-02, A2-03 | FO snapshot30/20,20/30,equal,no-enemy; three-player proportional3/7 and ID tie; independent large integer1073741824/1073741823 and666666667/666666667/666666666 losses.        |
| A2-04, A2-05        | FO later current forces/dead attacker and fixed c,b,a seeded ties/reversed reconstruction/whole-tick cross-destination RNG.                                                    |
| A2-06, A2-07        | FO ordinary/no-Assault versus mapped renamed Assault/reversed list/schema controls; merged attacker destruction prevents second original without rebound.                      |
| P2-01, P2-02, P2-03 | I/C real router funded40/20 Attack30, exact7.080338258080797 reload, arrival10/no defender/null clearing/cost once/idle; actual transaction rollback seam retained.            |
| P2-04, P2-05        | C Attack/Move aggregate and occupied arrival/reuse/Turn races; I Attack replacement/cancel and actual B configured10/25/mappings/eligibility.                                  |
| P2-06               | E combat full normal setup/7.08 reload/current10 survivors/opponent deletion/unchanged claimed owner/release and14 Influence0 Fuel.                                            |

## Commands and actual exits

All commands used pnpm and authorized absolute checkout, require_escalated where needed. Independent gates were batched; no dependent mutations raced. Exact Storybook build prefix and E2E prefix/tty were used.

| Command                                                                                                                                                                               | Result                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm exec storybook skills stories / write-story (frontend cwd)                                                                                                                       | Each0; installed guidance read.                                                                                                                                           |
| pnpm --filter shared test (before tester edits)                                                                                                                                       | 0;25 files277 tests.                                                                                                                                                      |
| pnpm --filter backend test --project unit --project integration --project types                                                                                                       | 0;11 files139 tests; no type errors;118.68s.                                                                                                                              |
| pnpm --filter backend test --project concurrency                                                                                                                                      | 0;4 files20 tests;67.19s; actual PostgreSQL.                                                                                                                              |
| pnpm lint                                                                                                                                                                             | 0 before and after tester changes.                                                                                                                                        |
| pnpm typecheck                                                                                                                                                                        | 0.                                                                                                                                                                        |
| pnpm --filter shared typecheck                                                                                                                                                        | 0 before and after tester changes.                                                                                                                                        |
| pnpm --filter backend typecheck                                                                                                                                                       | 0.                                                                                                                                                                        |
| pnpm --filter frontend typecheck                                                                                                                                                      | 0.                                                                                                                                                                        |
| pnpm --filter frontend storybook:test                                                                                                                                                 | 0;16 files73 tests including native project.                                                                                                                              |
| pnpm --filter frontend build                                                                                                                                                          | 0.                                                                                                                                                                        |
| pnpm --filter frontend storybook:build                                                                                                                                                | 0; exact reviewed prefix.                                                                                                                                                 |
| pnpm --filter frontend e2e playwright/specs/actions.spec.ts playwright/specs/fleets.spec.ts playwright/specs/combat.spec.ts playwright/specs/colonization.spec.ts --add-reporter=list | 0;7 passed1.6m; setup retained; actual runner exit.                                                                                                                       |
| pnpm --filter frontend e2e --add-reporter=list                                                                                                                                        | 0;22 passed1.6m; setup retained; actual runner exit.                                                                                                                      |
| pnpm exec oxfmt --write packages/shared/src/turn-resolution/colonization.test.ts                                                                                                      | 0 after each edit.                                                                                                                                                        |
| pnpm --filter shared test src/turn-resolution/colonization.test.ts (first new-test run)                                                                                               | 1;68 passed/1 failed solely because new test expected incorrect existing payment wording. Corrected test oracle to literal existing public outcome; no production change. |
| pnpm --filter shared test (final tester inputs)                                                                                                                                       | 0;25 files279 tests;968ms.                                                                                                                                                |
| git diff --check                                                                                                                                                                      | 0 before and after tester changes.                                                                                                                                        |

Only shared test input changed after broad application/backend/component gates, so reran full shared/type/lint gates; production inputs to backend/frontend remained identical. Full E2E completed after final shared-only assertions.

## Defects, unexecuted gaps and ownership

Demonstrated production defect IDs: **none**. Initial new-test failure was an incorrect test string, not application failure. Infrastructure failures: none. Non-fatal output included Node module.register, pg concurrent-query, Clerk development-key, NO_COLOR/FORCE_COLOR and Storybook module-directive warnings; gates still exited0.

No binding04 or retained contract was deferred to05. Hosted latest-head CI/PR delivery is root-owned and was not executed by this tester. Coverage instrumentation was not run separately; full behavioral suites were run. This report does not approve future product/documentation changes.

Final ownership check: no node/pnpm/browser process whose command line references this checkout remained. Ports10136/10137/10138 have no listener; Playwright owned backend/frontend exited. No manually started Storybook service. DB10135/container cosmic-empires-worktree-45-db-1 remains unchanged; unrelated6006/PID5872 and unrelated databases preserved. No forced kill, DB reset/reseed or environment-value edits.

**ALL WRITING/OWNED PROCESSES STOPPED** after saving/formatting this report and final diff check.
