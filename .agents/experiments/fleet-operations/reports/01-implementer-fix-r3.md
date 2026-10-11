# Increment 01 implementer fix r3

## Identity and R2-01 disposition

Checkout `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`, branch `codex/fleet-operations-sol`, unchanged HEAD/base `aa9272ec2b9ac756aa5d606bca900875ff9f58ed`. Sole writer after reviewer r2 stopped. Approved v1 A1-01 through A1-18, requirements and later-scope exclusions remain unchanged.

R2-01 is repaired with bounded shared integrity validation. Before any Move departure or journey advancement, a positive saved journey must have existing distinct route endpoints and remaining distance exactly consistent with route length, saved speed and elapsed Turns. A stale journey already due to have arrived also fails. A local canonical distance-after-Turns function serves both integrity validation and advancement; there is no tolerance, second clock or alternate progress algorithm. The existing typed FailedToResolvePhases failure reports inconsistent state instead of silently overwriting it.

No source-fleet existence, current departure ownership, strength, range or current definition speed is reapplied to continuation. Full allocation may remove its original source. Saved speed remains authoritative; costs, deterministic identity, phase order, payment and release behavior are unchanged. Pay Costs still precedes Fleet Movement; failed turn state is not persistable, and the new tests assert no fleet departure/progress mutation, rather than claiming atomic rollback of earlier phases.

## Changed paths in this repair round

- `packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts`: pre-departure route/progress checks and one reused canonical arithmetic function.
- `packages/shared/src/action-submission/persistedJourney.test.ts`: eight independent literal JSON-reload corruption cases (four variants with no submission and with new Y10), preserving the original binding-corruption and source-gone/current-definition-change controls.
- `docs/architecture/turn-resolution.md`: synchronize existing integrity explanation.
- This assigned report only. No other-role reports, plan, run-state, env values, main checkout, API/frontend/config/data/schema changes or commits.

Root/shared/backend/docs instructions, persona, reviewer r2 report, standards/glossary/tools-ts, continuation architecture and relevant Results/domain-schema guidance were rechecked against the previously read approved packet and authoritative requirements. No architecture or gameplay-design contradiction was found.

## Literal evidence and acceptance mapping

Failed-before run: valid X20 from source50 on distance5/speed2/Turn1 leaves source30 and remaining3. FleetSchema accepts real JSON reload of origin replaced with destination (remaining3), remaining reduced to0.5, or increased to4. Resolving Turn2 with a legal Y10 returned Success in all three cases: altered origin arrived early; altered progress became1; Y departed and source became20. The expected typed-failure assertions failed (3 failures/15 passes, exit1).

Final tests also exercise the reviewer’s exact no-submission variants and an altered origin referencing another existing Planet. All eight return typed failure, preserve every fleet unchanged (including source30 and original corrupt remaining), and prevent Y departure. Assertions use literal3/0.5/4 and exported resolveTurn/FleetSchema; no production progress helper computes test expectations.

- A1-13/A1-14: eight new corruption cases plus retained 14 binding-invalid cases demonstrate typed corruption failure before fleet mutation, including another pending departure.
- A1-10/A1-11/A1-12: existing full-allocation JSON-reload control remains green when current definition speed/range becomes1/1; original source is absent, saved speed2 yields remaining1 then arrival50, resources remain Influence3/Fuel1. Existing partial 2/2/1 reload/replay, merge and one-payment tests pass.
- A1-12/A1-13 numerical control: existing literal distance1/speed0.1 arrives Turn10; distance1+Number.EPSILON arrives11; Number.MIN_VALUE route arrives1. Existing zero-distance distinct-Planet and occupancy/release tests pass. No epsilon/range relaxation added.
- Remaining A1 criteria remain unchanged; full shared and backend unit/integration suites were rerun. Untouched frontend/browser/concurrency gates are not claimed rerun by this bounded repair.

## Commands and completed exits

All commands ran in the exact authorized worktree using pnpm and escalated checkout access. Runtime processes were followed through completion.

| Command                                                                                          | Exit | Result                                                                                             |
| ------------------------------------------------------------------------------------------------ | ---: | -------------------------------------------------------------------------------------------------- |
| `git branch --show-current`; `git rev-parse HEAD`                                                |    0 | Exact authorized branch/base.                                                                      |
| `pnpm --filter shared test src/action-submission/persistedJourney.test.ts` before production fix |    1 | 3 new failures/15 passes; demonstrated Success instead of typed corruption failure.                |
| Same focused command immediately after production fix                                            |    0 | 18 tests passed.                                                                                   |
| `pnpm --filter shared test` final expanded regressions                                           |    0 | 124 tests / 21 files passed.                                                                       |
| `pnpm --filter shared test --coverage` final                                                     |    0 | 124/21 passed; statements90.32%, branches84.13%, functions85.94%, lines91.28%.                     |
| `pnpm -r typecheck` first new-test check                                                         |    1 | TS7053 on inferred regression fleet map; corrected with explicit ResolvedTurnState fleet-map type. |
| `pnpm -r typecheck` final                                                                        |    0 | Shared/backend/frontend compiler projects passed.                                                  |
| `pnpm typecheck` final                                                                           |    0 | Root compiler passed.                                                                              |
| `pnpm lint` first regression check                                                               |    1 | no-conditional-in-test; replaced conditional submissions with explicit table-driven order lists.   |
| `pnpm lint` final                                                                                |    0 | Zero-warning gate passed.                                                                          |
| `pnpm --filter backend test --project unit --project integration`                                |    0 | Full affected projects:104 tests / 8 files passed; session35507 completed in42.03s.                |
| `pnpm --filter backend test --project types`                                                     |    0 | 12 type tests / 1 file passed; no type errors.                                                     |
| `pnpm exec oxfmt --write` on the three changed production/test/doc paths and assigned report     |    0 | Deterministic write-format completed.                                                              |
| `git diff --check` final                                                                         |    0 | Whole dirty increment whitespace check passed; existing CRLF conversion notices only.              |

Earlier green shared runs119 and122 preceded the final test-table expansion; final124/coverage and final recursive types/lint are the applicable evidence. After those runs the only production change was comment style; behavior is identical.

## Limits and stopped handoff

No remaining bounded R2-01 gap or environment blocker is known. No frontend UI, Storybook/E2E/build, real-PG concurrency or backend coverage gate was rerun solely to repeat untouched gates; current repair changes no adapter, transaction or persistence representation. Backend integration uses real production router/repository/TurnProcessor paths with PGlite and does not establish PostgreSQL lock semantics. No fresh independent acceptance or latest-head CI claim is made. Fresh whole-increment tester and reviewer remain required by the orchestrator.

All worker-started runtime processes completed; no server was started and no pre-existing resource was stopped. ALL WRITING STOPPED after final formatting and diff verification. Ready for fresh independent gates.
