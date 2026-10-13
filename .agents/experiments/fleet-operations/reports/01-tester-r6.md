# Increment 01 tester r6 — bounded quality retest

Verdict: **BOUNDED QUALITY RETEST PASS** for the current formatting-only handoff. No demonstrated formatting-induced defect or test change is required. This verdict does not independently rerun or replace the whole-increment gameplay gates retained separately by the orchestrator.

## Scope and authority

- Checkout: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`; verified branch `codex/fleet-operations-sol`.
- Base: `aa9272ec2b9ac756aa5d606bca900875ff9f58ed`.
- Contract: increment 01 v1 approved 2026-10-10; A1-01 through A1-18 unchanged. Read the full increment packet, authoritative requirements, initial plan, template, and tester persona. Requirements supersede older colonization text; combat/colonization and chronological arrivals remain outside this increment.
- Production and tests were read-only. The only authored file is this report. No fixes, assertion weakening, skips, source/config/environment changes, commits, pushes, PRs, subagents, manual gameplay SQL or database reset.
- Prior reports and run-state contents were not read or used as correctness evidence. A Git status listing named the existing ledger; its contents were not opened. Root's separately reported runtime results are not claimed as this tester's execution.
- Read root/shared/backend/frontend/docs/Playwright AGENTS, coding standards, glossary, installed tools-ts README, ADR index and 007/008/010/011/013/015–018/020/022–031, turn-resolution/processing guides, GDDR index/009, and Systems index/001/003/008/010/011/012/014/015. Applied Storybook workflow and E2E guidance to source inspection; loaded installed Storybook stories/write-story guidance. No visual UI changes or preview were created.

## Independent production comparison

Used a fresh Node byte comparison: `git show <base>:<path>` supplies each Git-base buffer; `fs.readFileSync` supplies current bytes. Compared buffers directly and separately compared UTF-8 content after replacing CRLF with LF. The comparison script exited 0.

| Production path under `apps/backend/src/lib/rulesets/` | Base/current byte length | Base/current CRLF count | Exact byte equality | Equality after CRLF→LF |
| ------------------------------------------------------ | -----------------------: | ----------------------: | ------------------- | ---------------------- |
| `CoreRulesets.ts`                                      |                209 / 209 |                   0 / 0 | yes                 | yes                    |
| `rulesets.repository.ts`                               |              2683 / 2683 |                   0 / 0 | yes                 | yes                    |
| `standard/StandardRuleset.ts`                          |              1686 / 1686 |                   0 / 0 | yes                 | yes                    |

The requested expectation was newline normalization only. The stronger observed evidence is that these current LF files are already byte-identical to the approved Git base, with no source-line or semantic delta. A prior working-tree CRLF state is not reconstructable from this base comparison, so this report does not claim to have witnessed that earlier transformation. The nine focused ruleset units independently exercise CoreRulesets/Standard declarations, JSON reload and malformed mapping rejection; they are not a live repository/database test.

## Current test coverage inspected

This is an inspection mapping, **not a claim that these suites executed in r6**. Compared the tracked test delta against base and included relevant untracked test/support files explicitly. Read current fixtures/assertions rather than relying on test titles or previous reports.

Key files:

- Shared `actionEligibility.test.ts` (AE), `fleetBoundaryIndependent.test.ts` (FB), `persistedJourney.test.ts` (PJ), `computeAvailableActions.test.ts`, and `FleetMoveEffect.test.ts` (ME).
- Backend `fleetActions.integration.test.ts` (API), `fleetActions.concurrency.test.ts` (PG), relevant `TurnProcessor.integration.test.ts` movement/merge scenarios (TP), and `CoreRulesets.unit.test.ts` (RU).
- Frontend `ActionCard.stories.tsx` (UI), its colocated stub and real `toActionEligibilityState` projection, `FleetsPage.stories.tsx`, and `playwright/specs/fleets.spec.ts` (E2E).
- Setup seams: shared renamed fixture and `FleetActionsScenario.stub.ts`; real-PG `ControlledConcurrencyTestApiServer` migrations/production repositories, injected clock/processor and disposal.

| Criterion | Independently inspected observable assertions and coverage boundaries                                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1-01     | AE checks 20+30 accepts, aggregate51 shortfall1 under reversed enumeration and prepayment rejection. API retains 20/30 after rejected31 and accepts mixed definitions. UI tests30/31. E2E uses the same real snapshot at all three adapters with literal10/4+6/4+7 budget.                                                                                                |
| A1-02     | AE replaces20 with15 to committed45/available5; cancellation leaves30 and its single3/1 cost. API verifies failed edit retention, replacement/cancel saved selections and resources. UI proves invalid draft stays local and can still cancel.                                                                                                                            |
| A1-03     | AE/FB literal6 Influence/2 Fuel totals, third3/1 shortage and total5 shortage1; FB rejects same-turn funding before payment. API resource failure preserves all saved actions/resources/fleets.                                                                                                                                                                           |
| A1-04     | AE parameterized missing/0/-1/fractional/51/nonfinite/unsafe/null/string cases distinguish incomplete draft from illegal completion; bounds1/50. API tests numeric and raw structural errors and saved-order retention; UI absent strength disables submission.                                                                                                           |
| A1-05     | AE enemy/missing-origin/transit/exhaustion and wrong type/nonexistent cases. API foreign-game fleet/planet, missing target, moving child and same-game enemy tests preserve saved owned order, including both identity/home assignments. E2E observes enemy/nonexistent/transit rejects across real projection/router/resolver.                                           |
| A1-06     | AE uses explicit(3,4), (3,4.000001), changed source(10,0), new destination(10,3), source-ID exclusion and coincident distinct planet. Source candidate remains eligible despite stale destination/strength. UI clears destination after choosing second source, retains invalid20 draft, accepts corrected10.                                                             |
| A1-07     | Shared fixture renames ID/name/tier/tags; range4 rejects while speed1 does not alter range. AE/FB reject missing/wrong mappings, unsupported constraints, absent ownership/stationary/range, multiple moves, unused input and bad numeric parameters. RU JSON tests assert exact3/1/0.1/5,3/3/1/5,3/5/5/25 and mapping data. **RU executed fresh.**                       |
| A1-08     | AE duplicate-instance/current strength19 and resource failures; FB adds changed owner/transit/current resources. Availability fixture checks two same-definition entries. UI fresh19 overrides cached eligibility. API and E2E exercise distinct instances and occupied versus independent actions.                                                                       |
| A1-09     | UI ProjectedResolverParity calls actual frontend projection with totals/reservations and actual resolver. E2E obtains public router snapshot, calls actual frontend projection/resolver and sends raw router requests, comparing substantive paths/messages, resources, invalid inputs/sources/range and retained orders. Not merely three direct shared evaluator calls. |
| A1-10     | AE literal source15 and children20/15 each distance3, stable source identity and identical fleet state under reversed input. Fixture uses speed2/range5; its expected values are literal. API separately observes persistence of partial departure.                                                                                                                       |
| A1-11     | AE full20+30 removes origin and merges20 into stationed7→27 preserving ID/name; hostile7 unchanged with own20 separate; reordered friendly arrivals conserve50 and stable survivor. TP uses API-built destination/home fleets and observes merge identity/20 strength through production persistence.                                                                     |
| A1-12     | FB carries the entire paid state across reload/replay:30 stationary,20 journey at3 then1 then arrival; resources3/1 remain unchanged, with current speed changed. PJ full50 travels using saved2 despite changed current speed/range. API/TP verify DB reload, literal distances and fuel paid once.                                                                      |
| A1-13     | AE/PJ occupancy/release and malformed journey bindings. API rejects occupied edit/cancel and old-turn payload, allows sibling on remainder; TP/E2E assert IN_PROGRESS then next-turn availability. UI disables numeric editing, presents bound journey/destination and has no cancel control.                                                                             |
| A1-14     | AE distinct coincident arrival, malformed transit schema, terminal zero cleanup and corruption failure. PJ rejects saved reference, route/progress and identity corruption before mutations. ME explicitly removes a source after Pay Costs, expects explanatory PREVENTED, retains3/1 payment, empty pool and instance availability.                                     |
| A1-15     | PG launches Promise.allSettled requests30/30 and20/30; asserts exactly1/2 successes, BAD_REQUEST failures,30/50 commitments,20/0 uncommitted, preserved50 after processing, positive survivors. PostgreSQL18.4 harness uses migrated real DB and production repos. No sleep oracle.                                                                                       |
| A1-16     | PG two costly orders accept exactly one with insufficient remaining resources; replacement25 versus sibling cancellation allows the two valid serial outcomes only. Final readiness/deadline race uses controlled clock and production promotion; rejects after deadline.                                                                                                 |
| A1-17     | Seven UI stories use deterministic view/local controlled harness: cumulative30/31, invalid edit cancellation, source invalidation/correction, fresh sibling cancellation preserving local31 draft, fresh strength19, progress state and projection parity. Saved-order output/visible shortfalls/input values are observable assertions.                                  |
| A1-18     | Seeded two-player E2E assigns right-home traveler from observed account ordering; builds10 normally, moves4 to fixed56:07:50, observes remainder6/journey4, literal3.77→2.77→1.77→0.77→arrival, reload, busy instance and fuel3 unchanged then availability. Fleet/map strength and origin/destination navigation assertions remain.                                      |

Assertion/setup assessment: shared oracles are literal budgets/distances and expected result paths; replay/reordered runs test deterministic identity rather than copy production calculations. The stronger FB paid-state reload scenario complements the older AE continuation scenario. API gameplay setup and observation use routers and normal actions, not direct table mutations. Real-PG setup seeds only ruleset infrastructure and normal account setup, then routes gameplay; PGlite is not offered as locking proof. Promise races accept only specified serial outcomes. Story harness arithmetic models displayed fixed fixture stockpiles; substantive eligibility is exercised through the real projection/component. Browser geometry expectations are literal, not computed with the production distance helper.

## Commands actually executed

All quality/test commands ran in the assigned checkout, and each returned its actual process exit. No running exec session remained.

| Command                                                                                | Actual exit | Evidence                                                                  |
| -------------------------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------------- |
| Independent Node three-path byte/normalized comparison                                 |           0 | Exact evidence above; branch check returned `codex/fleet-operations-sol`. |
| `pnpm format`                                                                          |           0 | Actual script `oxfmt --check`; all586 matched files correctly formatted.  |
| `git diff --check`                                                                     |           0 | No whitespace diagnostics.                                                |
| `pnpm lint`                                                                            |           0 | Actual script `oxlint --max-warnings 0`; no diagnostics.                  |
| `pnpm typecheck`                                                                       |           0 | Actual root script `tsc -p tsconfig.json`.                                |
| `pnpm --filter shared typecheck`                                                       |           0 | Actual shared script `tsc -b`.                                            |
| `pnpm --filter backend typecheck`                                                      |           0 | Actual backend script `tsc`.                                              |
| `pnpm --filter frontend typecheck`                                                     |           0 | Actual frontend script `tsc -b`.                                          |
| `pnpm --filter backend test --project unit src/lib/rulesets/CoreRulesets.unit.test.ts` |           0 | 1 file,9 tests passed; runner fully exited.                               |

Initial sandbox Git reads could not access linked worktree metadata; the authorized exact-workdir escalation resolved that. The first escalated `pnpm format` was rejected by automatic review as a presumed production write. After supplying the already-read package.json proof that this exact command invokes read-only `oxfmt --check`, the same command was approved and completed exit0. No indirect bypass or production mutation occurred. These were infrastructure/approval events, not application failures.

Post-authoring report-only formatting and whitespace checks are recorded in the closing handoff. Formatting uses oxfmt write on this report only.

## Limits and closure

No full shared, backend integration/concurrency, Storybook, E2E, coverage or build suite was executed by r6. Their unchanged current acceptance assertions were independently inspected for the whole increment; their runtime receipts remain the orchestrator's separate responsibility. A1-15/16 locking and A1-17/18 browser runtime are therefore inspection evidence here. This report does not establish new full acceptance, CI status, migration runtime or a comprehensive production architecture review. A separate fresh reviewer follows this bounded tester.

For the independently verified three production paths there is no source content delta that could change any A1 behavior. All required bounded static gates and the meaningful affected ruleset unit command passed. No production defect reproduction or scope expansion is warranted by this handoff.

**BOUNDed scope:** report only; tests changed: none; defects demonstrated: none. No app, frontend, Storybook or test container listener was started by this tester. The existing worktree DB is preserved. **ALL WRITING/PROCESSES STOPPED** at handoff after report formatting and final read-only verification.
