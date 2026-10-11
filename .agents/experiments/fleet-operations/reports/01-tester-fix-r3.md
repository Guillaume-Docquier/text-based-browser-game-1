# Increment 01 tester fixture correction r3

2026-10-10. Approved packet v1 (approved2026-10-10), unchanged A1-01..A1-18. Worktree C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1; branch codex/fleet-operations-sol; base aa9272ec2b9ac756aa5d606bca900875ff9f58ed.

## Finding and reproduction

**O1-06: confirmed test fixture instability, corrected.** Root invalidated initial acceptance with `pnpm --filter backend test --project integration --project concurrency fleetActions`, session37266, EXIT1,10 passed/1 failed. The initial owned4 submission failed with Destination exceeds range5 before the intended enemy-source ownership rejection. The earlier `01-tester-r3.md` PASS is preserved unchanged and does not approve this new diff.

I parameterized the existing account stub API with fixed valid UUIDs ending001/002 and swapped requester/opponent identities, retaining ordinary create/join/start/build/turn actions. Before changing destination selection, `pnpm --filter backend test --project integration fleetActions -t 'same-game enemy'` exited1: lower identity passed, higher identity failed with Destination exceeds range5. This is deterministic reproduction, not an assumed flaky application failure. No production defect demonstrated.

## Bounded test-only fix

- `apps/backend/src/api/gameplay/fleetActions.integration.test.ts`: two fixed identity assignments now select a distinct in-range destination using observed source-origin public x/y coordinates. `Math.hypot` serves setup selection only. Explicit distinct-ID and distance<=5 preconditions plus successful owned4 public submission verify setup. Literal assertions origin.x>50 for lower identity and origin.x<50 for higher identity prove both seeded homes were exercised. BAD_REQUEST ownership cause, enemy owner/stationary/strength10, full saved actions/resources/fleets retention and original owned4 targets remain unchanged.
- `apps/frontend/playwright/specs/fleets.spec.ts`: inspection found the same hidden assumption because Clerk-backed account registration generates random internal UUIDs. Observed public seeded home now assigns explicit traveler/opponent roles: whichever player owns the right-side home is the traveler. Ordinary actions and production APIs remain setup. Existing fixed56:07:50 route,4/6 allocations, enemy100, resource8/2 and shortfall4, parity rejections, literal3.77/2.77/1.77/0.77/arrival distances, locks/reload and one payment remain unchanged.
- This assigned report only. No production, auth, ruleset, compiler configuration, environment value or other report modifications.

Other public fixtures inspected: FleetActionsScenario and fleet concurrency cases use one-player games, whose seed home has no multi-player UUID-order swap; resource-budget addition uses that same public single-player setup. actions.spec is also single-player. No further newly added two-player fixed-home assumption found in this scope. Synthetic component/shared exact50 strength and distance5/speed2 oracles are untouched.

## Commands and exits

Every shell command used the exact absolute worktree. Runtime/writes used authorized require_escalated; pnpm only. Test processes were followed through explicit exit.

| Command                                                                                             | Current result                                                                   |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Controlled pre-fix enemy regression                                                                 | EXIT1,1 passed/1 failed/5 skipped; higher identity fails initial valid setup     |
| `pnpm --filter backend test --project integration fleetActions -t 'same-game enemy'` after fix      | EXIT0,2 passed/5 unrelated skipped                                               |
| `pnpm --filter backend test --project integration --project concurrency fleetActions` session96614  | EXIT0,12 passed/2 files; exact root failure command now passes                   |
| `pnpm --filter backend test --project integration --project types` session87015                     | EXIT0,107 passed/8 files; no type errors                                         |
| `pnpm lint` final                                                                                   | EXIT0                                                                            |
| `pnpm typecheck`                                                                                    | EXIT0                                                                            |
| `pnpm --filter backend typecheck`                                                                   | EXIT0                                                                            |
| `pnpm --filter frontend typecheck` final                                                            | EXIT0                                                                            |
| `pnpm --filter backend exec tsc --noUnusedLocals --noUnusedParameters`                              | EXIT0                                                                            |
| `pnpm --filter frontend exec tsc -p tsconfig.playwright.json --noUnusedLocals --noUnusedParameters` | EXIT0                                                                            |
| `pnpm --filter frontend e2e playwright/specs/fleets.spec.ts --add-reporter=list` session70729       | EXIT0,4 passed including3 setup; observed-home setup before final actor renaming |
| Same focused E2E final actor naming session3396                                                     | EXIT0,4 passed including3 setup; server cleanup completed                        |
| `pnpm exec oxfmt --write` changed files/report                                                      | EXIT0                                                                            |
| `git diff --check`                                                                                  | EXIT0; unrelated existing CRLF warnings only                                     |

E2E used run-e2e-tests and frontend/playwright instructions, tty:true, reviewed prefix, PLAYWRIGHT_HTML_OPEN=never and PLAYWRIGHT_LIST_PRINT_STEPS=1. These are runner settings, not service environment edits. Nonfatal known Clerk development-key/color and pg already-executing-query warnings remain.

Intermediate static runs after actor renaming found a test-only shadowed traveler variable (frontend typecheck/lint EXIT1); corrected the name, both final checks and explicit noUnused gates pass. An initial edit script stopped with marker-missing EXIT1 before mutation because it expected CRLF; repaired newline-independent matching. A preliminary random-identity focused test passed1 but was not relied on; fixed swapped identities subsequently reproduced the failure.

## Verdict and limits

O1-06 is corrected with deterministic coverage of both router home assignments. **Current affected test/static gate: PASS.** This correction does not claim a new full-increment independent acceptance; root requested fresh tester4/reviewer after handoff. Unchanged shared/component/build/full-E2E/coverage gates were not rerun solely for counts. One final browser flow exercises observed-home role normalization with unchanged literal route assertions; I do not claim controlled both-home browser executions or DB/auth reset. Both home branches were deterministically executed at the real router boundary.

**ALL WRITING STOPPED after saving and formatting this report.** Sessions96614/87015/70729/3396 all reached explicit EXIT0. Final process/listener inspection returned no same-checkout node processes and no listeners10136/10137/10138. Pre-existing preview resources were untouched in this correction pass; no manual service termination was needed. No commits, push, PR or main edits.
