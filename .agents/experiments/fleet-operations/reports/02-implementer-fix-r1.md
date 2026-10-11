# Increment 02 implementer correction r1

Date: 2026-10-10. Finding: O2-S1. Scope: bounded saved-journey corruption boundary correction; this report does not approve packet 02 or replace independent tester/reviewer evidence.

Worktree: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`. Branch: `codex/fleet-operations-sol`. HEAD remains `e4c0710d46bb54e12946e568a7406fecf7c5ae30`. Approved packet 02 v1 and requirements remain binding. Existing reports, root ledger, packet, environment and main checkout preserved.

## Correction

- `packages/shared/src/turn-resolution/resolveTurn.ts`: move the existing `validateSavedFleets` preflight before submitted-action eligibility. Eligibility reads persisted journey submission bindings; their integrity must be established first. The existing typed `FailedToResolvePhases` / `FailedEffect` boundary handles malformed saved state before effects, payment or departure. No duplicate validation, broad exception catch, schema weakening or UI/persistence change.
- `packages/shared/src/action-submission/fleetBoundaryIndependent.test.ts`: the previous transit fixture contains a destination but no journey. Its expected failure is now `FAILED_TO_RESOLVE_PHASES`, labelled malformed transit. Owner, strength and resource cases retain `INVALID_SUBMISSIONS`. This accounts for the changed error precedence rather than asserting that the corrupt fixture is coherent.
- `packages/shared/src/turn-resolution/fleetOperations.test.ts`: preserve the tester regression, valid affordable control and all typed-error/immutability assertions. Repair its TypeScript/lint errors by finding source-0 through the typed fleet values, constructing a first-turn state rather than assigning readonly submittedActions, and placing the regression inside the existing describe block. No gameplay expectation weakened.

## Before and after

Before production correction, `pnpm --filter shared test src/turn-resolution/fleetOperations.test.ts -t 'missing its submission'` exited 1: one failed, 57 skipped. The saved child with only movement.submittedAction removed caused TypeError in actionEligibility.ts while accessing playerId before fleet preflight.

After moving preflight, the same unchanged test exited 0: one passed, 57 skipped. The valid control still sends a new independent strength10 order from source20, leaving source10 and resources90/98. The corrupted state returns the nested typed failure and remains deeply unchanged. The final explicit two-test command below also proves coherent saved transit followed by an initially illegal moving-source submission still returns INVALID_SUBMISSIONS without mutation.

The first full shared rerun exited 1 (199 passed / one failed) solely because the older malformed transit fixture expected INVALID_SUBMISSIONS. Its corrected expectation follows the same M2-09 saved-state integrity contract. The subsequent final suite passes all 200 tests.

The first static run exposed the tester regression's branded indexing and readonly assignment errors (exit 1); after those repairs a subsequent lint run exposed its top-level test placement (exit 1). These test-only repairs are included above. Final static gates all pass.

## Current candidate gates

All commands executed with pnpm in the exact worktree and actual runner completion observed. These receipts concern the corrected candidate; earlier implementation PASS results are not candidate approval.

| Exact command                                                                                                                                       | Actual exit | Result                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec oxfmt --write packages/shared/src/turn-resolution/resolveTurn.ts packages/shared/src/action-submission/fleetBoundaryIndependent.test.ts` | 0           | Changed production/expectation files formatted                                                                                    |
| `pnpm exec oxfmt --write packages/shared/src/turn-resolution/fleetOperations.test.ts`                                                               | 0           | Retained regression formatted after repairs                                                                                       |
| `pnpm --filter shared test`                                                                                                                         | 0           | Final 200 tests / 24 files passed                                                                                                 |
| `pnpm --filter shared test src/turn-resolution/fleetOperations.test.ts -t 'missing its submission\|initially illegal moving source'`                | 0           | Two passed, 56 skipped                                                                                                            |
| `pnpm btu`                                                                                                                                          | 0           | 11 tests / one file passed                                                                                                        |
| `pnpm bti`                                                                                                                                          | 0           | 102 tests / eight files passed; in-memory integration, including public gameplay/resolver paths                                   |
| `pnpm btc`                                                                                                                                          | 0           | 11 tests / three files passed; real PostgreSQL testcontainers concurrency/persistence paths; runner completed after 38.36 seconds |
| `pnpm --filter backend test --project types`                                                                                                        | 0           | 12 tests / one file; no type errors                                                                                               |
| `pnpm typecheck`                                                                                                                                    | 0           | Root                                                                                                                              |
| `pnpm --filter shared typecheck`                                                                                                                    | 0           | Shared                                                                                                                            |
| `pnpm --filter backend typecheck`                                                                                                                   | 0           | Backend                                                                                                                           |
| `pnpm --filter frontend typecheck`                                                                                                                  | 0           | Frontend                                                                                                                          |
| `pnpm lint`                                                                                                                                         | 0           | Root, zero warnings                                                                                                               |
| `git diff --check`                                                                                                                                  | 0           | No whitespace errors                                                                                                              |

The regex command's literal pipe is part of the -t argument. Integration runner completed after 78.23 seconds. PostgreSQL emitted the existing concurrent-client query deprecation warning; runner exit remained 0. No service reset/reseed command was issued by the implementer; test-owned setup/cleanup ran through the standard suites.

## Contract and limits

O2-S1 maps to M2-09/no-throw engine corruption: missing persisted submission fails through domain integrity and typed Result before current costs/departure without mutation. The independent valid control proves the current order is otherwise payable. The retained coherent moving-source test separately proves initial illegal submission rejection. Full shared coverage retains legal gameplay destruction as explanatory Prevented.

This is raw exported shared-engine corruption evidence, not evidence that public loaders accept malformed JSON. No original2/original3, A2/P2 or retained A1 scope was narrowed. No fresh UI, Storybook or browser/E2E gate was performed for this bounded engine correction; root will route fresh packet-wide testing/review. No older browser result constitutes approval of this candidate.

## Ownership and handoff

No backend10136/frontend10137/Storybook10138 runtime was started. All test runners completed with their actual exits and standard owned cleanup. Final listener inspection found only preserved DB10135 (PIDs25828/18476); app/Storybook ports absent. No unrelated process was stopped, no environment value changed, no commit/push/PR created.

ALL WRITING/PROCESSES STOPPED. Available for subsequently routed findings.
