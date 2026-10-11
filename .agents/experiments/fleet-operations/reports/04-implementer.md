# Increment04 Implementer handoff

Implementation is complete against the unchanged approved v1 packet. This is implementation and primary validation evidence, not root acceptance or an independent review.

- Checkout: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`.
- Branch: `codex/fleet-operations-sol`; unchanged HEAD: `53db264ccba9bcbed12f31d50e0ec1536f928477`.
- Packet: `increments/04-colonization.md`, v1 root-approved2026-10-10; approved SHA256 `AFF138F9792C7004AE8BF57C868B4851C0908DC4FFB7D06CDFF50E234E9478EE`.
- Sole writer; no subagents, commit, push, PR, merge, main-checkout changes, environment-value edits, database reset/reseed, migration or new ADR/GDDR/System.
- Root dirty report02/run-state/report04 and approved packet were preserved.

## Result and boundaries

Shared COLONIZE has exactly one configured requiredStrength parameter and shares the owner/force predicate between actual submission validation and post-Combat resolution. Moving selected force is reserved once; stationary fixed Strength reservations participate in the same complete-set accounting. UNCLAIMED_PLANET and exact-ID AT_FLEET_PLANET dependencies drive real UI candidates and clearing. Initial eligibility and saved integrity remain separate: a saved journey survives a newly claimed destination and finishes with prevention.

Indexed pending definitions are a narrow ASSAULT|COLONIZE union. Saved bindings are checked before costs; Combat and Colonization consume only their own variants. Canonical eligible-only ties use persisted RNG by Tick then Planet. Immutable original submission/priority survives actual Fleet merging. Successful Colonize replaces the keyed readonly Planet value, changes only owner, subtracts configured Strength once, and deletes zero. Prevention spends no extra force and performs no refund/return. Ordinary Move and Assault remain unchanged.

The worker captures original owner scalars before resolveTurn. Only changed owners are updated, scoped by gameId+planetId, in the same actual save transaction as Fleets/resources/Turn/Actions/queue/RNG. Real-PG fault assertions run after the awaited production save writes; retry uses concrete production loading and worker reset. No SQL scenario setup, test repository, observing repository subclass, mocked calculation, or invented scenario RNG is used.

Standard moving content25Influence/min20/speed1/range5/one instance and independent Test10/25/two instances are authored separately. Stationary content25Influence/min20/one instance has no numeric input. Both cost no Fuel or Colony. Existing resource catalogue remains. Docs remove superseded Colony, full Fleet consumption, Population and return claims for current Colonization; development/vision/Terraforming remain planned.

One bounded presentation correction sets Fleets remaining-distance display to two decimals (7.70 matches the approved browser oracle); existing2.5 component expectation is now2.50. No broader number formatter changed.

## Primary increment evidence

S = `packages/shared/src/turn-resolution/colonization.test.ts` (67 tests), plus shared domain/eligibility implementation. I = `apps/backend/src/api/gameplay/colonization.integration.test.ts` (12 normal-router scenarios). C = `colonization.concurrency.test.ts` (8 real-PG scenarios). B = actual ActionCard/TargetPicker plays and FleetsPage stories. E = actual Playwright `colonization.spec.ts`.

| Criterion | Concrete evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C4-01     | S exact20/21/35/configured25 literals and19/24 pre-cost rejection; I router19 rejection and20/21/35 journey/arrival; C persisted20 deletion/21→1 and35→15 explicit SQL null clearing; E35→15.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| C4-02     | S reversed effect list and Combat35 versus16→19 or35→death; I real normal generated-route opponent staging and composed custom35, post-Combat19/deletion, ownernull, cost9/release.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| C4-03     | S no implicit enemy16 combat and initially claimed own/enemy rejection; I independently staged enemy16 plus no-Assault custom gives15/16 and claim; E final15/35 co-presence preserves winner owner.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| C4-04     | S earlier current19/dead0 then valid35 Tick2 then35 Tick3, exact winner/losers, unchanged1234 RNG, whole Result/final RNG equal under reversed reconstruction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| C4-05     | S real earlier departures produce valid saved children; canonical a/b/c tie yields c,b,a winnerc/15, others35, final3663132860/null. Invalid fourth19/dead0 does not change winner/RNG. Two canonical Planet UUIDs P<Q yield b,a then c,d, b/c15, a/d35, exact final3663132860/null in reversed enumeration. C real secret persisted input/RNG whole Result replay and reversed reconstruction, next-Turn RNG/world receipt.                                                                                                                                                                                                                                                                                                                                                |
| C4-06     | S20+20→40→20, preexisting station7 ID retained47→27, later ordinary15 merges current35→15; I two normal20 departures merge40 and consume20 once/both release/resources4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| C4-07     | S stationary20+Move30/source50 valid,31 shortfall1; two stationary20 reserve40 and plusMove10 reserve50,11 shortfall1; cancellation and mapped source replacement shift only own reservation. Moving35+extra15 fits/16 shortfall1. Valid stationaryTick0 wins before movingTick1. Damaged/dead stationary20 prevents; a saved later journey succeeds on following resolution. Same-resolution variants independently assert Combat16 across station20/third-owner35 leaves station14 and colonizer25 then5; Combat20 with its own later35 merged55 loses20 then35→15, dead station removed, owner2 claims. C simultaneous20+30 and20+31, failed edit preserves30/cancel exposes20, deletion/child30, real final-readiness/deadline race. B source clearing/50→30/cancel→50. |
| C4-08     | S configured25 thresholds/reservations and parameter validity; I separately persisted renamed EXPAND/ESTABLISH content24 rejection,25 deletion/35→10, stationary25+Move25 valid/26 shortfall1; B configured moving24/25 and stationary source24 filtered/25 selected with actual Reserve25 text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| C4-09     | Shared composition tests reject duplicate effects/missing owned/stationary/unclaimed/role/dependency/input mappings; exact coincident wrong Planet ID rejected. B claimed origin excluded, weak19 station excluded, source change clears dependent destination and disables submission, invalid edit preserves saved35. Retained source/range/malformed/foreign-game parity tests still run through full suites.                                                                                                                                                                                                                                                                                                                                                            |
| C4-10     | S distance5/saved2 continuation3/1/0 force35 then15; original outcome Turn/action/selections, no replay. Saved three-effect reversed list has pendingColonize0/Assault1, each own phase exactly once, final19 prevention and idle no outcomes. Missing/duplicate/index/variant/requiredStrength/mapping/extra/unsafe strength/missing player/Planet/forged child/impossible progress fail unchanged with valid control. C actual pending reload/explicit null/release/rollback/retry.                                                                                                                                                                                                                                                                                       |
| P4-01     | Normal-router fixture uses Campaign/ExtractT1, Build10+CampaignT2..5, CampaignT6/T7; assertions7/7/1/0 then40/29/3/1/0. E identical UI/readiness setup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| P4-02     | I and C actual generated35:35:40, literal7.77754335587613, selected20/21/35, busy cancellation, production processor reload, owner/full Planet attributes, survivor/deletion, explicit clear and release, unchanged cost/idle. E7.78 and independent second instance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| P4-03     | I/C actual rightT8/leftT9, left7.703963225688675 after right claim, reload/processT10 then15/35, bothorigin5/resources4/3/1/0, released originals/no transit. E7.70/reload/actual owner and markers/final same costs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| P4-04     | C public stationary50 via five Builds, ordinary Attack travel, Campaign and RefineFuel to30/0/5; concurrent20+30/31, saved edit/cancel, owner/deletion/child30/resources2/0/4/0. Real readiness/deadline race resolves only committed set. I alternate25+25/26.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| P4-05     | C two saved35 journeys compete after concrete repository getNextTurnForProcessing/startTurnProcessing, immutable capture, existing resetProcessingAttempt, recreated worker. Actual secret RNG replays identically, reversed loaded maps give same whole Result/RNG, committed nextTurn10 RNG/Fleet rows/owner equal replay.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| P4-06     | C same server second same-map game untouched whole public+DB state; after actual awaited writes fault produces failed processing, no ownership/Fleet/resource/Actions/nextTurn/queue/RNG escape, actual PROCESSING closure preserved. Reset/retry commits one owner15/explicit null/release/expected replayed nextTurn RNG, then idle unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| P4-07     | New actual browser spec roles by observed homes; all funding/build/selection/readiness and reloads through POM/UI. StarSystemMap aria owner and Owned planets username change,15/35 markers, bothorigin5,7.78/7.70, dashed journey clears, resources4/3/1/0 and originals AVAILABLE but cost-disabled. Focused4 and full22 actual runner exit0.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| P4-08     | Actual plays ColonizeThreshold, ColonizeConfigured25, StationaryColonize, ColonizeCandidates, StationaryBudget, StationaryConfigured25; current-view ColonizationSurvivors15/35 owners/no journey plus existing Fleets controls. Full maintained and native/component gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Retained acceptance evidence

These concrete retained suites ran in the final full gates. AE = shared actionEligibility/fleetBoundaryIndependent/candidatePrerequisites/persistedJourney tests; FO = shared fleetOperations/FleetMoveEffect tests; FI/FC = backend fleetActions integration/concurrency; CI/CC = backend combat integration/concurrency. Existing stories and actual browser specs were executed, not inferred from earlier reports.

| Criterion | Retained primary evidence                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A1-01     | AE complete-set50/20+30/31 and FI; existing ActionCard allocation plays.                                                        |
| A1-02     | AE own edit exclusion/cancel and FI/FC edit/cancel transaction races.                                                           |
| A1-03     | AE complete-set resources/gain exclusion and FI/FC resource budget.                                                             |
| A1-04     | AE missing/malformed/bounded strength parser and actual FI rejection.                                                           |
| A1-05     | AE owned/stationary/game-scoped source and FI invalid sources.                                                                  |
| A1-06     | AE candidate prerequisites/exact range/dependent destination and TargetPicker browser tests.                                    |
| A1-07     | AE saved integrity/persistedJourney, FO corruption controls.                                                                    |
| A1-08     | AE authoritative fresh complete-set projection and FI current-state validation.                                                 |
| A1-09     | fleetBoundaryIndependent tests plus FI adapter boundaries and actual component plays.                                           |
| A1-10     | FO split deterministic children20/15/remainder15, FI normal public departures.                                                  |
| A1-11     | FO full allocation/own station merge/enemy separation, FI resulting rows.                                                       |
| A1-12     | FO and persistedJourney continuation2/2/1, FI reload and fixed saved speed/cost.                                                |
| A1-13     | persistedJourney/FO occupancy/release, FI and current ActionCard in-progress plays.                                             |
| A1-14     | FO exact zero distance/empty pool/failure versus prevention and FI.                                                             |
| A1-15     | FC actual PostgreSQL30/30 and20/30 source50 races.                                                                              |
| A1-16     | FC actual resource/edit/cancel/readiness/deadline races; retained lobby suite.                                                  |
| A1-17     | Existing ActionCard allocation/source/edit/in-progress plays and TargetPicker.browser tests.                                    |
| A1-18     | Actual fleets.spec.ts normal setup/partial movement/reload/release in full E2E22.                                               |
| M2-01     | FO positiveMIN_VALUE, true zero, full-turn ticks and resulting order.                                                           |
| M2-02     | FO fraction/tie/decimal boundary and2/2/1 continuation; FI saved continuation.                                                  |
| M2-03     | FO chronological/stationed/canonical survivor and reversed reconstruction.                                                      |
| M2-04     | FO Movement+Build before Combat; CI public normal staged forces.                                                                |
| M2-05     | FO split ordinary/Attack lifecycle/saved parameters; FI/CI/FC/CC occupancy; browser fleets/combat.                              |
| M2-06     | FO merged actual37/25/current second effect/provenance, CI own merged forces.                                                   |
| M2-07     | FO deferred pool/payment once/empty pool/replay, CI/CC persisted arrival.                                                       |
| M2-08     | FO initiating origin/index/grouping with no current submission and later reuse.                                                 |
| M2-09     | FO destroyed/zero-terminal prevention and invalid saved binding controls; CI/CC release/clearing.                               |
| A2-01     | FO exact30/20,20/30,20/20,no-enemy snapshot Results; CI actual damage/deletions.                                                |
| A2-02     | FO multi-owner/apportionment/ID tie/reversed order; CI normal public staging.                                                   |
| A2-03     | FO independently specified exact large integer loss/remainder literals.                                                         |
| A2-04     | FO later current/dead forces and CC saved replay.                                                                               |
| A2-05     | FO seed1234 canonical c,b,a/reversed input/final RNG.                                                                           |
| A2-06     | FO ordinary/enabled/renamed/reversed effect composition; CoreRulesets.unit ordinary content retained.                           |
| A2-07     | FO merged destroyed actual ID and per-order prevention; CI normal same-owner merge.                                             |
| P2-01     | CI/CC actual normal-funded30 journey/right10/defender20/reload/arrival10/null clearing/release.                                 |
| P2-02     | CI and actual combat.spec.ts resource7/7/1→19/3/1→14/0 setup literals.                                                          |
| P2-03     | CI/CC production save/rollback/replay/release/idle; FO replay.                                                                  |
| P2-04     | CC Attack+Move aggregate races, FC retained edit/resource/readiness/deadline.                                                   |
| P2-05     | fleetBoundaryIndependent and CI complete-set adapters; existing AttackAllocation/DestinationFirstAttack/AttackInProgress plays. |
| P2-06     | Actual combat.spec.ts observed roles,7.08 reload,10 survivor and unchanged ownership in E2E22.                                  |

## Completed validation receipts

All commands used pnpm in the exact checkout, with reviewed escalation. Exit codes below are actual process completion, not intermediate output. Formatting used oxfmt --write in bounded owned-file batches. No test was skipped for increment05.

| Command                                                                         | Final result / actual exit                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| pnpm exec oxfmt --write (all changed apps/packages/docs files; bounded batches) | 0                                                       |
| pnpm lint                                                                       | 0                                                       |
| pnpm typecheck                                                                  | 0                                                       |
| pnpm --filter shared typecheck                                                  | 0                                                       |
| pnpm --filter backend typecheck                                                 | 0                                                       |
| pnpm --filter frontend typecheck                                                | 0                                                       |
| pnpm --filter shared exec vitest run --silent=true                              | 25 files / 277 tests PASS; 0                            |
| pnpm --filter backend exec vitest run --silent=true                             | 15 files / 159 tests PASS; 0; 122.18 seconds            |
| pnpm --filter backend test --project types                                      | 1 file / 12 PASS, no type errors; 0                     |
| pnpm --filter frontend build                                                    | 0                                                       |
| pnpm --filter frontend storybook:build                                          | Exact approved prefix; 0                                |
| pnpm exec storybook tools test run (frontend cwd, owned10138)                   | 58 passing story IDs; 0                                 |
| pnpm --filter frontend storybook:test                                           | 16 files / 73 native+component tests PASS; 0            |
| pnpm --filter frontend e2e -- (focused colonization spec)                       | 4 PASS; 0; owned runner services cleaned                |
| pnpm --filter frontend e2e (full suite)                                         | 22 PASS; 0; backend10136/frontend10137 absent afterward |
| git diff --check                                                                | 0                                                       |

Final full backend includes unit/integration/concurrency projects and final stationary-readiness/deadline race. Shared focused colonization67 and final full277 passed. Final two cases changed only colonization.test.ts; all production, backend/browser/native fixtures and content stayed unchanged, so backend159/native73/E2E22/build receipts remain applicable. Earlier corrected full backend158 passed before that final added race; final159 supersedes it. Normal test-owned PostgreSQL setup/disposal was allowed; isolated worktree DB was preserved.

Iteration failures were corrected and rerun: nonexistent test:integration script replaced with actual Vitest runner; Vitest5 silent syntax corrected; optional HTTP omitted fields asserted undefined separately from explicit SQL null; old content-count assertions updated with independently authored new entries while retaining ordinary expectations; fixture typing/lint/format corrected; browser7.70 formatter scoped to fleet distance. The first browser failure was7.7 display versus7.70; focused4 and full22 passed after correction. A final added stationary assertion initially used null coalescing, rejected by no-conditional-in-test lint; its unconditional alias table then passed full shared277, shared typecheck and root lint, all exit0. No failed gate remains.

Replay evidence is in colonization.concurrency.test.ts: real loaded rngState constructs the replay RNG; reversed immutable input produces strictly equal whole Result and final RNG; committed Turn10 compares both rngGeneratorState and rngSpareNormal to that exact final replay state. Rollback compares Turn9 original secret RNG unchanged; retry compares committed Turn10 to its independent captured replay. Numeric secret generator values vary per real game and are not manufactured as scenario seeds. Shared fixed seed1234 has the independent literal final generatorState3663132860/spareNormalnull, for one and two canonical Planet groups.

## Changed file inventory

Production, tests and affected existing docs:

- apps/backend/src/api/gameplay/gameplay.router.integration.test.ts
- apps/backend/src/lib/rulesets/CoreRulesets.unit.test.ts
- apps/backend/src/lib/rulesets/standard/StandardRuleset.ts
- apps/backend/src/tests/CombatActionsScenario.stub.ts
- apps/backend/src/tests/ConcurrencyTestApiServer.ts
- apps/backend/src/turn-processing/TurnProcessor.ts
- apps/backend/src/turn-processing/turns.repository.ts
- apps/frontend/src/features/play/components/ActionCard.stories.tsx
- apps/frontend/src/features/play/components/ActionCard.stub.ts
- apps/frontend/src/features/play/components/ActionCard.tsx
- apps/frontend/src/features/play/components/TargetPicker.tsx
- apps/frontend/src/features/play/effectDefinitionToRulesText.ts
- apps/frontend/src/features/play/fleets/FleetsPage.stories.tsx
- apps/frontend/src/features/play/fleets/FleetsPage.tsx
- docs/architecture/turn-processing.md
- docs/architecture/turn-resolution.md
- docs/game-design/systems/001-turns.md
- docs/game-design/systems/003-actions.md
- docs/game-design/systems/008-planets.md
- docs/game-design/systems/010-fleets.md
- docs/game-design/systems/011-combat.md
- docs/game-design/systems/012-movement.md
- docs/game-design/systems/014-resources.md
- docs/game-design/systems/015-rules-engine.md
- docs/game-design/systems/README.md
- docs/glossary.md
- packages/shared/src/action-submission/actionEligibility.ts
- packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.ts
- packages/shared/src/domain/ruleset/effect-definitions/EffectDefinition.ts
- packages/shared/src/domain/ruleset/target-definitions/TargetConstraint.ts
- packages/shared/src/domain/ruleset/target-definitions/TargetDefinition.ts
- packages/shared/src/domain/world/fleets/PendingArrivalEffect.ts
- packages/shared/src/testing/test-ruleset/TestRuleset.ts
- packages/shared/src/turn-resolution/FleetOperationsScenario.stub.ts
- packages/shared/src/turn-resolution/TurnState.ts
- packages/shared/src/turn-resolution/effects/EffectFactory.ts
- packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.ts
- packages/shared/src/turn-resolution/phases/implementations/resolveColonizationPhase.ts
- packages/shared/src/turn-resolution/phases/implementations/resolveFleetCombatPhase.ts
- packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts
- apps/backend/src/api/gameplay/colonization.concurrency.test.ts
- apps/backend/src/api/gameplay/colonization.integration.test.ts
- apps/backend/src/lib/rulesets/standard/action-definitions/colonize-planet.ts
- apps/backend/src/tests/ColonizationActionsScenario.stub.ts
- apps/frontend/playwright/specs/colonization.spec.ts
- packages/shared/src/action-submission/colonizationEligibility.ts
- packages/shared/src/domain/ruleset/effect-definitions/ColonizeEffectDefinition.ts
- packages/shared/src/testing/test-ruleset/action-definitions/colonize-planet.ts
- packages/shared/src/turn-resolution/ColonizationScenario.stub.ts
- packages/shared/src/turn-resolution/colonization.test.ts
- packages/shared/src/turn-resolution/effects/implementations/ColonizeEffect.ts

Own evidence files: `reports/04-implementer.md` and `reports/04-implementer-colonization.png`. Root-owned dirty records and approved packet are excluded from this inventory.

## Rendered and browser evidence

[04-implementer-colonization.png](04-implementer-colonization.png) is an actual1200x600 render of the isolated Storybook FleetsPage `ColonizationSurvivors` component fixture. It shows Alice15 and Bob35 at Mars4:5:6 and cleared transit. It is not the generated public35:35:40 scenario. Root visually inspected it. Actual P4-07 public browser behavior is separately demonstrated by colonization.spec.ts and actual focused4/full22 exits.

Maintained Storybook review URL: http://localhost:10138/?path=/review/ (seven new stories and existing ManyFleets control, eight stories in two groups). Actual preview URLs used for review:

- http://localhost:10138/?path=/story/application-action-card--colonize-threshold
- http://localhost:10138/?path=/story/application-action-card--colonize-configured-25
- http://localhost:10138/?path=/story/application-action-card--stationary-colonize
- http://localhost:10138/?path=/story/application-action-card--colonize-candidates
- http://localhost:10138/?path=/story/application-action-card--stationary-budget
- http://localhost:10138/?path=/story/application-action-card--stationary-configured-25
- http://localhost:10138/?path=/story/application-fleets-page--colonization-survivors

The preview is now stopped under the root handoff instruction so an independent tester can own subsequent services. These URLs identify the reviewed stories; they require a newly owned preview to open. Storybook dev's watch wrapper exited1 when deliberately stopped after all test commands completed; that is service shutdown, not a failed gate. A late built-static font watcher EBUSY was observed in its dev output during static build; the final static build and maintained/native runners all exited0.

## Scope, limitations and cleanup

No approved plan/scope deviation or new gameplay requirement. No acceptance was deferred to05. The bounded two-decimal Fleets presentation fix and normal concrete worker claim/load/reset seam were reported to root. Outcomes stay in resolver results; no persisted history endpoint was added. This report is not independent acceptance. Both following-resolution and same-resolution damaged/dead Tick0 variants now run. Same-turn damage gives third-owner winner5/station14; same-turn dead station gives merged winner15. The valid stationaryTick0/movingTick1 competition also remains. Root/fresh tester should assess these concrete tests against the immutable packet rather than treat prose as proof.

All test commands reached actual exits. E2E-owned10136/10137 services were absent after full runner exit0. Own Storybook10138 node48912, cmd30356 and pnpm30136 were stopped only after fresh commandline and parent-chain verification. Its wrapper session closed; PID8052/watch descendants and processes whose commandlines named this checkout were absent. Final listener inventory retained DB10135 (25828/18476) and unrelated main Storybook6006 PID5872;10136/10137/10138 absent. No unrelated service/helper was stopped. Worktree45 DB was preserved; no reset/reseed/env edit.

Final Git identity and packet hash were reverified: branch codex/fleet-operations-sol, HEAD53db264ccba9bcbed12f31d50e0ec1536f928477, packet SHA256AFF138F9792C7004AE8BF57C868B4851C0908DC4FFB7D06CDFF50E234E9478EE. Root-owned records remained outside writer scope. Work is uncommitted for root review.

ALL WRITING/PROCESSES STOPPED. Handoff is ready for root and fresh independent tester/reviewer; the implementer remains available only for routed fixes.
