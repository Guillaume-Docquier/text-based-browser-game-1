# Increment 01 implementer fix r1

Root: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`.
Branch: `codex/fleet-operations-sol`.
HEAD/base: `aa9272ec2b9ac756aa5d606bca900875ff9f58ed`.
Approved v1 contract and all A1-01..18 remain unchanged. This report records implementation/self-validation; it is not independent acceptance.

## T1-r1-01 disposition

Reproduced the independent tester's missing-definition regression before editing production: a genuine X20 child with saved speed2/distance3 was changed only to reference `missing-definition`. Continuation returned Success/distance1 rather than the required typed phase failure. The test command exited1.

The Fleet Movement Phase now validates each positive saved journey's binding before resolving any departures or advancing journeys:

- Referenced Action Definition exists and passes its domain composition schema.
- The saved Action instance exists in the Ruleset pool and references that definition.
- The initiating player exists and FleetSchema's owner association remains valid.
- The definition contains exactly one Move; selected target/input keys exactly match its declared slots.
- Mapped destination equals the child's persisted destination, source selection exists, and surviving child Strength does not exceed its saved selected allocation.
- Persisted Turn is not in the future, and the child identity matches its initiating game/player/Turn/Action/source tuple.
- A player/Action instance cannot be bound to two positive journeys.

Failures use the existing EffectError/ResolvePhaseError boundary, producing `FAILED_TO_RESOLVE_PHASES`. No new endpoint, service, workflow abstraction or migration was introduced.

Departure and binding checks call the same extracted `getDepartureFleetId` helper. Its namespace and input tuple are unchanged, preserving deterministic IDs and names. The source Fleet need not remain: the identity binds its saved source ID without looking up the exhausted/deleted source. Continuation uses saved speed, skips departure eligibility/resource/range checks, and never republishes the order, pays costs again or reserves resources again.

## Regression evidence

`packages/shared/src/action-submission/persistedJourney.test.ts` retains the tester's original nonexistent-definition reproduction and typed-failure oracle. Its describe/title and equality style were adjusted to satisfy repository lint rules; the behavior and failure expectation were not weakened.

Thirteen related corruption cases create a real valid departure before altering persisted binding or current Ruleset composition: missing pool instance, known definition/pool mismatch, definition without movement, changed declarative movement tags, missing source, altered source ID, destination mismatch, missing input, unexpected input, child Strength greater than selected allocation, future initiating Turn, missing player and duplicate occupied instance. All assert typed failure and unchanged positive Fleet/player state.

A separate full-allocation continuation test departs50, proves the original source is absent, JSON-reloads the genuine child, then continues using a current definition with speed1/range1. It still advances with saved speed2 to distance1 and then arrival. Selection/binding retain50; resources remain Influence3/Fuel1 after every continuation, proving no repayment. The existing partial2/2/1, deterministic replay, terminal removal and fractional-speed regressions also pass in the full shared suite.

## O1-04 disposition

Removed the unused `_uncommittedResources` parameter and obsolete call argument from `toActionDtos` in `getPlayerView.useCase.ts`. Action eligibility still uses `model.resources` totals and shared commitments; accounting behavior is unchanged. The router fleet suite and static checks were rerun after this signature cleanup.

## Files changed in this fix pass

- `packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts`: saved binding validation before continuation.
- `packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.ts`: shared deterministic departure identity helper.
- `packages/shared/src/action-submission/persistedJourney.test.ts`: preserved independent failing regression plus related corruption and legitimate continuation cases.
- `apps/backend/src/api/gameplay/getPlayerView.useCase.ts`: O1-04 obsolete argument/parameter removal.
- `docs/architecture/turn-resolution.md`: existing journey documentation describes integrity versus departure eligibility.
- This assigned fix report. Prior implementer/tester/orchestrator reports, packet/run-state and environment values were not edited.

## Commands and completed exits

All commands used the exact authorized worktree; no process was abandoned. The following final successful checks supersede intermediate fix-test failures.

| Command                                                                                                                                         | Exit and evidence                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter shared test src/action-submission/persistedJourney.test.ts` before repair                                                        | 1; reproduced original missing-definition Success/distance1.                                                                                                                                                                                       |
| `pnpm exec oxfmt --write` with the changed shared/backend/doc files and this report                                                             | 0.                                                                                                                                                                                                                                                 |
| `pnpm --filter shared test src/action-submission/persistedJourney.test.ts src/action-submission/actionEligibility.test.ts` after initial repair | 0;31 tests/2 files.                                                                                                                                                                                                                                |
| `pnpm --filter shared test src/action-submission/persistedJourney.test.ts` with expanded cases                                                  | 0;15 tests/1 file.                                                                                                                                                                                                                                 |
| `pnpm --filter shared test:coverage`                                                                                                            | 0;108 tests/20 files; statements90.06%,branches83.75%,functions85.79%,lines91.1%.                                                                                                                                                                  |
| `pnpm --filter backend test:coverage`                                                                                                           | 0;115 tests/11 files; no type errors, unit/integration/real PostgreSQL concurrency/types included. Statements81.82%,branches76.8%,functions90.11%,lines80.88%. This full run includes the journey repair, before the signature-only O1-04 cleanup. |
| `pnpm --filter backend test --project integration src/api/gameplay/fleetActions.integration.test.ts` after O1-04                                | 0;3 tests/1 file; persisted partial movement, locks/edit/cancel, continuation/payment and arrival release through real routers/production repositories.                                                                                            |
| `pnpm lint`                                                                                                                                     | 0 after final changes, rerun after O1-04.                                                                                                                                                                                                          |
| `pnpm --filter shared typecheck`                                                                                                                | 0.                                                                                                                                                                                                                                                 |
| `pnpm --filter backend typecheck`                                                                                                               | 0, including rerun after O1-04.                                                                                                                                                                                                                    |
| `pnpm --filter frontend typecheck`                                                                                                              | 0.                                                                                                                                                                                                                                                 |
| `pnpm typecheck`                                                                                                                                | 0, including rerun after O1-04.                                                                                                                                                                                                                    |
| `git diff --check` and final branch/HEAD check                                                                                                  | 0; exact identity above confirmed.                                                                                                                                                                                                                 |

An initial expanded test falsely observed second-turn arrival because resolving third Turn mutated the reused second-turn object; the test now clones that prior state before resolving the next Turn. Lint requested outer-scope key comparison, describe/title/style compliance; TypeScript required branded target indexing and explicit Reflect corruption of readonly records. These were corrected; no expectations were removed. Backend logs contain expected rejected-request diagnostics, pg client-query deprecation and Vitest's experimental type-test notice. Final checks have no unexplained failure.

## Limits and handoff

This fix proves A1-13/A1-14 saved-binding corruption rejection and preserves A1-12 saved-speed/full-allocation continuation. It does not independently approve the entire increment. The fresh tester's broader pending criterion/adapter audit remains required. Frontend builds, Storybook and E2E were not rerun in this fix pass, per the orchestrator's bounded validation direction for a shared repair and a signature-only backend cleanup; prior results are not presented as fresh fix-pass evidence.

No known failing affected check remains. No main, environment, plan/criteria or other-role report edits; no commit/push/PR or subagent. All writing is stopped at handoff, and the implementer remains available only for routed fixes while fresh testing/review proceeds.
