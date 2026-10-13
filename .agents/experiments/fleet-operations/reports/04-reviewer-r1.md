# Increment 04 — fresh reviewer r1

## Identity and verdict

- Reviewer: fresh Fleet Operations Reviewer, gpt-6.1-sol/high.
- Exact checkout: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`.
- Branch: `codex/fleet-operations-sol`; accepted base and actual HEAD: `53db264ccba9bcbed12f31d50e0ec1536f928477`.
- Approved packet: `increments/04-colonization.md`, v1/root approved 2026-10-10; independently verified SHA256 `AFF138F9792C7004AE8BF57C868B4851C0908DC4FFB7D06CDFF50E234E9478EE`.
- Verdict: **ACTIONABLE FINDINGS R4-R1-01 and R4-R1-02**. No demonstrated production correctness, architecture, harmful duplication, unnecessary abstraction or missing-generalization defect found in the complete current increment diff. Passing tests do not discharge the two findings below.

This review independently used primary requirements, initial plan, increment template, approved01/02/04 contracts, persona, code and tests. No prior implementation, tester, reviewer, orchestrator confidence report or run-state narrative was opened. All C4-01..10/P4-01..08 and retained A1-01..18/M2-01..09/A2-01..07/P2-01..06 were treated as binding now; none was assigned to05.

## Actionable findings

### R4-R1-01 — synchronize the authoritative Turns status with live Colonization (P2)

Location: `docs/game-design/systems/001-turns.md:7` (the new current-integration section is at line68).

Trigger/reproduction: read the Status paragraph, which explicitly says “Surprise Assault, Planet Development, and Colonization resolution remain planned,” then read the new line70 paragraph declaring Colonization current. The fixed resolver sequence actually invokes the implemented Colonization phase, and independently executed shared/public/browser success tests claim ownership and consume force.

Consequence: this same changed System document simultaneously identifies Colonization as planned and implemented. A reader following its primary Status summary gets the wrong current scope. Adding the footer did not synchronize the existing status statement.

Basis: approved04 implementation step7 requires existing Systems001/003/008/010/011/012/014/015 and indexes to describe current versus planned behavior honestly; root AGENTS and docs/AGENTS require existing behavior/status to track live mechanics. Fix the Status paragraph to include implemented moving/stationary Colonization while retaining Surprise Assault, development and the placeholder Victory limitations. No new design approval or record is required.

### R4-R1-02 — claimed-target component oracle is masked by source-planet prohibition (P2, acceptance evidence gap)

Location: `apps/frontend/src/features/play/components/ActionCard.stories.tsx:496`, with fixture provenance in `ActionCard.stub.ts:49` and `actionEligibility.stub.ts:45`.

Trigger/reproduction: inspect `ColonizeThreshold`'s claimed-candidate assertion. It checks that `Origin` is absent. That fixture's only claimed Planet is also the selected source Fleet's origin. `WITHIN_FLEET_RANGE` independently rejects that exact Planet ID as no-op movement. `Boundary` and `Other` are both unclaimed. The stationary candidate story changes Fleet force/source but supplies no claimed same-location Planet. `TargetPicker.browser.test.ts` has no Colonize fixture, and the E2E flow issues both orders before the target is claimed.

Consequence: all current Colonize component stories can still satisfy their candidate assertions if the frontend loses the claimed-target condition while preserving the existing no-op/range condition. The current full component suite passed, but it does not independently establish the explicitly requested null-versus-claimed candidate boundary. This is an evidence gap, not a claim that current production filtering is incorrect; actual `getTargetOptions` delegates correctly to the shared evaluator.

Basis: C4-03/C4-09 require initial claimed target parity at real boundaries, and P4-08 explicitly requires actual ActionCard/TargetPicker plays for null/claimed candidates. ADR023/031 and the Storybook skill require observable regression assertions that protect concrete behavior. Add a bounded real-component scenario with a distinct, in-range claimed Planet and a comparable unclaimed candidate, sufficient resources and force, and assert only the unclaimed choice is offered. Own/enemy ownership variants can use the same focused fixture; preserve source/no-op checks separately. This addresses a meaningful oracle, not an arbitrary test count.

## Independent production conclusions

- Composition integrity: strict COLONIZE has mapped Fleet/Planet roles and a single positive safe whole requiredStrength schema. ActionDefinition enforces at most one Colonize, owned stationary source, unclaimed destination, shared Move roles or exact AT_FLEET_PLANET with no inputs. Three-effect order is phase-independent. Standard14/14 and independent Test14/17 content preserves ordinary Move/Attack costs/speeds/ranges and starting resources.
- Shared eligibility: frontend projection/Card/candidate picker, API UpdateActionSubmission complete-set validation under the Turn lock, GetPlayerView budgets and resolver validation use the actual shared evaluator. Owner checks delegate to isUnclaimedPlanet; initial and final force checks call evaluateColonization. Required25 and renamed IDs/tags affect data, not app branches.
- Accounting: moving35 is reserved35; stationary20+Move30 from50 fits and31 fails with shortfall1. Other commitments exclude the replacement's old identity. Own stationary reservation is not subtracted twice. Two stationary reservations are counted even though only one may later win. Cancellation releases its instance; transit is not reserved again.
- Saved integrity: FleetSchema, current ActionDefinition/pool binding, exact selected keys, deterministic child/progress and supported indexed pending union are checked before Pay Costs. Missing/duplicate/extra/wrong indexed variant, mappings, requirement, malformed strength and forged progress/identity are typed failures. Ordinary legacy missing list remains valid; Colonize missing list cannot silently disappear. Claimed-enroute ownership is deliberately not rechecked as initial eligibility.
- Activation/current state: factory suppresses immediate arrival mechanics. Stationary Tick0 is registered before departures; moving definitions persist once and activate on arrival. Combat filters ASSAULT before its retained canonical seeded schedule; Colonization filters COLONIZE. Movement/Build/Combat precede Colonization. Actual bindings redirect only through recorded friendly merging while original turn/action/selections/departure/Tick remain immutable.
- Prevention/competition: known terminal/combat destruction is Prevented; missing live binding/Planet or owner/location/strength corruption is Failure. Surviving shortfall/claimed targets spend no additional force and remain at destination. Colonization orders Tick, then code-point Planet ID, then canonical origin/index/departure; completes ineligible candidates canonically and shuffles eligible contenders only, with no0/1 draw. Winning current merged force consumes the configured amount once; zero is deleted/terminally marked. Original instances release next Turn without replaying payment/Move or confusing availability with affordability.
- Persistence: TurnProcessor captures original owner scalars before mutation. It produces only changed-owner entries. TurnsRepository updates owner only with Game ID+Planet ID and exact one-row assertion inside the actual save transaction containing resources, Fleet deletion/upsert/null clearing, current/next Turn, readiness, Actions, queue and RNG. Real PostgreSQL rollback and retry independently passed. Existing columns/JSONB need no migration; completed engine outcomes remain unpersisted, as documented.
- Boundaries: native erasable TS, shared persistence-agnostic runtime, named type-only frontend contracts, DI and Results are retained. API scenarios set up through routers and normal actions. Pregame custom RulesetsRepository authoring and read-only worker observations/claim-load-reset immutable replay are the explicitly permitted packet seams; no scenario SQL/geometry/force/resource manufacture or private use-case setup found.

## Acceptance evidence inspected and exercised

| Contract | Evidence inspected; independent execution below                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C4-01    | Shared configured20/25 literals; public19 rejection and20/21/35 arrival; real-PG zero deletion/null clearing                                                    |
| C4-02    | Reversed three-effect shared35 versus16/35 and real router normal opposing travel; post-Combat19/death prevention                                               |
| C4-03    | Shared no-Assault35/enemy16 and initial owner1/2 failure; public co-presence; component initial-claim oracle gap R4-R1-02                                       |
| C4-04    | Genuine saved arrivals early19/dead, later valid winner, reversed reconstruction and singleton RNG1234 unchanged                                                |
| C4-05    | Genuine prior departures, canonical c,b,a literal winner/state3663132860; invalid fourth; Planet P/Q b,a then c,d literals; actual durable secret-RNG replay    |
| C4-06    | Shared40→20 and station47→27 with original per-order outcomes; early20+ordinary15→15; public funded dual20 arrivals                                             |
| C4-07    | Shared stationary/source50 fixed sets/cancel/replacement/Tick0 damage/death; component budget; real-PG20+30/31 races and closure/deadline                       |
| C4-08    | Shared configured25 thresholds/budgets, component renamed25 input/station fixtures, pregame persisted custom public25/35 and stationary25+Move25/26             |
| C4-09    | Schema malformations, claimed initial ownership/exact ID, source changes and stationary candidates; retained shared/native source/range/input parity; R4-R1-02  |
| C4-10    | Shared5/speed2 continuation3,1,0/original deltas/corrupt controls; reversed two pending indexes each own phase once; real worker reload/claimed-enroute/release |
| P4-01    | Normal Campaign/Extract and repeated Build10 with literal funding; actual API and UI setup                                                                      |
| P4-02    | Public20/21/35 and35 real-PG rollback/retry/reload; occupied original/independent instance; released but resource-disabled; explicit clearing/idle              |
| P4-03    | Both views real-PG staggered right/left saved journeys,15/35/no implicit combat; browser7.78/7.70 and owner username                                            |
| P4-04    | Normal public50 travel/refine setup, exact30/0/5→2/0/4 resources, simultaneous20+30/31 and closure locks                                                        |
| P4-05    | Actual saved secret-RNG captured through concrete production repository, immutable replay/reversed keys/final persisted RNG                                     |
| P4-06    | Same-map second game remains identical; actual save abort after awaited Actions; public and hidden rows rollback; reset/retry exactly once                      |
| P4-07    | Independently executed UI flow: ownership/map/Owned planets and15/35/origin5, reload/cleared journeys and4/3/1/0 resources                                      |
| P4-08    | Actual Card/Picker thresholds20/25, stationary19/20/24/25, budgets, source clearing/edit/cancel and survivor presentation; isolated claimed target gap R4-R1-02 |

Retained A1-01..18/M2-01..09/A2-01..07/P2-01..06 primary contracts were read and relevant surrounding selection, movement, combat, outcome, availability and persistence code traced. Full shared279 and full component73 include their retained tests. This reviewer did not independently rerun all retained backend/E2E suites; that is a gate limitation, not grounds to defer their contract.

## Complete diff scope

Reviewed all40 tracked product/test/documentation paths changed against the exact accepted base and all11 untracked product/test paths (51 total). Included whole existing modified files where context mattered, not only hunks. The new untracked paths were:

- Backend: `colonization.integration.test.ts`, `colonization.concurrency.test.ts`, Standard `action-definitions/colonize-planet.ts`, `ColonizationActionsScenario.stub.ts`.
- Frontend: `playwright/specs/colonization.spec.ts`.
- Shared: `action-submission/colonizationEligibility.ts`, `effect-definitions/ColonizeEffectDefinition.ts`, independent Test `action-definitions/colonize-planet.ts`, `ColonizationScenario.stub.ts`, `colonization.test.ts`, `ColonizeEffect.ts`.

Tracked scope covered shared eligibility/schemas/pending/content/scenario/TurnState/factory/Move/all affected phases; backend gameplay expectations/core content/tests/support/processor/repository; frontend Card/Picker/rules text/stubs/stories/Fleets; all changed architecture/System/index/glossary documents. Root-owned ledger/reports/artifacts are excluded as confidence material and were preserved unopened.

Read actual root/shared/backend/frontend/Playwright/docs AGENTS, coding standards/glossary/installed tools-ts README, ADR index and accepted007/008/010/011/013/015/016/017/018/020/022/023/024/025/026/027/028/029/030/031, turn-resolution/processing, GDDR index/009 and Systems001/003/008/010/011/012/014/015/index. ADR032 is rejected, not applied. Storybook skill plus installed stories/write-story guidance and run-e2e-tests were read/announced before their applicable work.

## Commands actually executed

All runtime/Git commands used the exact authorized checkout with reviewed escalation where necessary. No formatter was run on frozen product/test/doc files.

| Command                                                                                                       | Actual result                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter shared test`                                                                                   | Exit0;25 files/279 tests passed                                                                                                                      |
| `pnpm --filter backend test --project integration src/api/gameplay/colonization.integration.test.ts`          | Exit0;1 file/12 tests passed;95.02s                                                                                                                  |
| `pnpm --filter backend test --project concurrency src/api/gameplay/colonization.concurrency.test.ts`          | Exit0;1 file/8 tests passed;51.40s;real PostgreSQL/Testcontainers                                                                                    |
| `pnpm --filter frontend storybook:test`                                                                       | Exit0;16 files/73 tests passed, including native Chromium;6.59s                                                                                      |
| `pnpm --filter frontend e2e playwright/specs/colonization.spec.ts --add-reporter=list`                        | Exit0;4 tests passed (3 setup+1 product flow);1.5min;tty true;setup retained;PLAYWRIGHT_HTML_OPEN never/LIST_PRINT_STEPS1;exact reviewed pnpm prefix |
| `pnpm exec storybook skills stories` and `pnpm exec storybook skills write-story`                             | Exit0;installed maintained guidance read                                                                                                             |
| `git diff --check 53db264ccba9bcbed12f31d50e0ec1536f928477`                                                   | Exit0                                                                                                                                                |
| `git rev-parse HEAD`, `git branch --show-current`, packet SHA256, before/final status and service inventories | Exit0;identity and frozen51-path scope confirmed                                                                                                     |

Warnings were Node module.register deprecation, Vitest experimental types warning, pg client.query deprecation, Vite mock interceptor hooks, and E2E color/Clerk development notices. They did not cause failures. E2E HTML report is the normal ignored `apps/frontend/playwright-report/index.html`; Storybook generated its normal ignored JUnit output. No new screenshot or source modification was made.

Unexecuted here: full backend unit/integration/concurrency/types, lint/typechecks, frontend build/Storybook build, full E2E, coverage and hosted/latest-head CI. This independent reviewer reports inspected versus run evidence, not a claim of those gates passing. The worktree is uncommitted at the exact accepted HEAD; no hosted CI result is asserted.

## Stop/ownership handoff

All five test invocations exited normally. Before E2E,10136/10137/10138 were absent; Playwright owned its temporary services, and after actual runner exit those ports were absent again. DB10135 remains on the originally observed owners25828/18476, with no reset/removal. No stop command was issued against unrelated6006/PID5872;6006 was observed listening initially and absent at final inventory, an external-state change communicated to root. No Git mutation/commit/push/PR/cloud/main-checkout or environment-file edits, no subagents, and no production/test/doc fixes were made. The only authored file is this assigned report; routine test outputs are ignored artifacts.

**ALL WRITING/PROCESSES STOPPED.** Root owns finding disposition and fixes, followed by a fresh affected test/full review gate.
