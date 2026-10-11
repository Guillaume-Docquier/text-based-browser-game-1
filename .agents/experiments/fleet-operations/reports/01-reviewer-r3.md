# Increment 01 — independent full review r3

Reviewer: Fleet Operations Reviewer, gpt-6.1-sol / high.
Worktree: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`.
Branch: `codex/fleet-operations-sol`.
Base: `aa9272ec2b9ac756aa5d606bca900875ff9f58ed`.
Contract: `01-eligibility-and-allocations.md`, v1 approved 2026-10-10; A1-01 through A1-18 unchanged.

## Verdict

One actionable finding, **R3-01 (P2)**. Complete submission validation rejects the demonstrated illegal sources, but destination candidate evaluation drops prerequisite errors. No additional actionable correctness, architecture, duplication, or concrete missing-generalization findings established in the full inspected increment. Green checks below do not erase R3-01 or constitute acceptance of deferred increments.

## Reviewed scope and inputs

This was a fresh full review against the supplied base, not a review of a selected fix. I enumerated tracked modifications/deletions and untracked files, then inspected every changed production, test, support, migration, configuration, and game/architecture documentation artifact and relevant surrounding callers. Prior experiment reports, previous comments, and run-state/confidence narratives were excluded as review inputs.

Required readings included the reviewer persona, complete approved increment packet, authoritative `requirements.md`, initial plan, increment template, root and scoped AGENTS instructions (shared, backend, frontend, Playwright, docs), TypeScript standards, glossary, installed tools-ts README, ADR index and ADRs 007/008/010/011/013/015–018/020/022–031, turn-resolution and turn-processing guides, GDDR index/009, and System index/001/003/008/010/011/012/014/015. Readings used bounded chunks; relevant material was reread when output was truncated. Authoritative requirements supersede the older colonization description.

The inspected implementation includes:

- Shared action/input/target/effect schemas and construction validation; numeric strength roles and mapped source tags; selected inputs and movement domain state; the new shared draft/candidate/set eligibility, commitments and availability paths; removed validators/accounting and their remaining callers; fixture and independent-content changes.
- API DTOs, named exported contracts, frontend type-only boundary, normalized scoped state and player view, router submission validation, aggregate replacement/cancellation, action-instance binding, production repositories, turn-row locking and the controlled concurrency harness.
- Fleet departure, source revalidation, canonical split order, positive arrivals/merge and zero-row deletion, per-instance locking/release, paid-once continuation, immutable stored action/effect/source/input binding, saved speed/range/distance/progress, reload validation, resolver phase ordering, movement persistence and null clearing. Surrounding build, cost, target resolution, turn processing, and game-start availability paths were inspected.
- Frontend normalized eligibility state, ActionCard/TargetPicker/ActionSelector, source-dependent choices and range, editable strength/drafts and safe source changes, submission hook, SearchSelect change, stories and fixtures, E2E specs/page objects, and all changed TypeScript configurations.
- The SQL migration, journal and full new snapshot; repository insert/update/delete behavior for selected inputs and movement; changed Standard/Test content; all changed game-system/architecture/glossary documents.
- Actual new and modified shared, backend router/integration/concurrency/ruleset/turn-processor, component/story and Playwright tests. Deleted validation implementations were compared with their replacement behavior and references searched. Newly added independent-boundary and persisted-journey tests were read rather than relying on their names or pass status.

The new snapshot was recursively compared with its predecessor. The only schema metadata differences were the new snapshot identity/previous identity and the nullable JSONB `selected_inputs` and `movement` columns; the previous identity matches the prior snapshot. No backfill is required by repository policy. Migration SQL and journal agree with those changes.

All A1-01–18 were considered against implementation and test evidence. This review does not claim implementation of coordinated 20-tick duration, stable original-allocation provenance, pending arrival effects, Assault, or Colonize; the approved packet defers those behaviors. The continuation and persistence implemented here were assessed within increment 01's actual contract.

## R3-01 — destination candidates discard invalid source prerequisites

**Priority:** P2.

**Location:** `packages/shared/src/action-submission/actionEligibility.ts:195` (issue filter, lines 195–200). UI consumer: `apps/frontend/src/features/play/components/TargetPicker.tsx:75`.

**Trigger:** Keep a selected fleet source in a draft and reevaluate an in-range destination against authoritative state in which that source is now enemy-owned, moving, or exhausted. The declared destination range constraint depends on this selected source.

**Observed behavior:** `evaluateActionSelection` produces invalid issues under the source's target tag. `evaluateTargetSelection` substitutes the destination, runs that same evaluation, then filters out all target issues except the destination's own tag. It returns `eligible` with an empty issue list for all three invalid-source cases. `getTargetOptions` consumes that status directly, so those destination choices remain selectable while their required source is invalid. Full-action eligibility and complete submission validation still reject the order; this finding does not assert illegal persistence or resource spending.

**Contract:** The approved packet's shared contract, line 54, says candidate eligibility is scoped to the slot **and its prerequisites**. Line 56 disallows silently dropped prerequisite failures. A1-05 and A1-08 require invalid/current-state source parity across boundaries; A1-06 separately requires source reselection to remain possible despite stale dependent destination or numeric values. The fix must honor both directions.

**Concrete reproduction:** A read-only native-Node diagnostic imported the exported evaluator and `createFleetEligibilityScenario`, formed `s.order('X', 20)`, changed only the authoritative selected source, and evaluated `targetTag: 'route', targetId: s.destination.id`. The fixture's source tag is `craft`. Actual output:

```text
enemy: candidate {status: eligible, issues: []}
complete: selectedTargets.craft — Target must be owned by submitting player
moving: candidate {status: eligible, issues: []}
complete: selectedTargets.craft — Source fleet must be stationary
exhausted: candidate {status: eligible, issues: []}
complete: selectedTargets.craft — Source fleet has no available strength
complete also reports selectedInputs.force — Insufficient fleet strength: shortfall 20
```

The diagnostic ran through `pnpm exec node --input-type=module` from `packages/shared`, exited 0, used only in-memory fixtures and exported production evaluation, and modified no files or database state. It compared actual candidate and complete results rather than relying on an earlier report.

**Actionability and requested regression:** Retain issues for the candidate slot's declared target prerequisites, deriving dependency tags from the actual constraint data. Do not filter on every unrelated full-draft error: that would trap valid source reselection when the old destination or strength is invalid. Add a retained exported-evaluator regression for each fresh invalid-source case and an observable component/options test showing destination choices disappear or become unavailable, while the existing stale-dependent source-reselection behavior remains valid. This is a concrete shared decision inconsistency under the approved contract, not a request for an arbitrary dependency abstraction or a taste-based refactor. Production/tests were left read-only for the orchestrator to route the fix.

## Checks actually executed

All listed processes completed with actual exit code 0:

| Check                                                                                                | Result                                         |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `pnpm --filter shared test`                                                                          | 125 tests, 21 files passed                     |
| `pnpm --filter backend test --project integration src/api/gameplay/fleetActions.integration.test.ts` | 7 tests passed                                 |
| `pnpm --filter backend test --project concurrency src/api/gameplay/fleetActions.concurrency.test.ts` | 5 tests passed                                 |
| `pnpm --filter backend test --project unit --project integration`                                    | 104 tests, 8 files passed                      |
| `pnpm --filter frontend storybook:test`                                                              | 54 tests, 15 files passed                      |
| `pnpm typecheck` at root                                                                             | Passed; root scripts/config scope only         |
| `pnpm exec tsc -p tsconfig.package.json --noEmit --incremental false` in shared                      | Passed                                         |
| `pnpm exec tsc -p tsconfig.node.json --noEmit --incremental false` in shared                         | Passed                                         |
| `pnpm exec tsc -p tsconfig.json --noEmit --incremental false` in backend                             | Passed                                         |
| `pnpm exec tsc -p tsconfig.app.json --noEmit --incremental false` in frontend                        | Passed                                         |
| `pnpm exec tsc -p tsconfig.node.json --noEmit --incremental false` in frontend                       | Passed                                         |
| `pnpm exec tsc -p tsconfig.playwright.json --noEmit --incremental false` in frontend                 | Passed                                         |
| Native candidate/complete diagnostic above                                                           | Reproduced R3-01; exit 0                       |
| Recursive migration snapshot diagnostic                                                              | Only expected metadata/columns changed; exit 0 |
| `git diff --check`                                                                                   | Passed                                         |

Before component tests I read and applied the Storybook workflow skill and installed Storybook `stories`/`write-story` guidance. Repository guidance selected the full `storybook:test` command. Backend API tests exercise the router and production repositories; I did not issue direct game SQL. Tests used their normal disposable fixtures/runtime. No development backend, frontend, or Storybook service was launched by this reviewer.

## Limits and final state

Playwright E2E behavior was inspected but not independently executed in this review. I did not independently run builds, lint, coverage, deployment, or the entire unrelated backend concurrency suite. The diagnostic establishes the exported shared decision defect; a new retained regression was requested rather than modifying tests under the reviewer restriction. No future-feature acceptance or undocumented compatibility guarantee is inferred from the checks.

Only this assigned review report was intentionally written. Production, tests, configuration and game documentation remain unedited by the reviewer. No worker, commit, push, PR, environment change, or application runtime was created. All owned test processes reached EXIT 0; final listening-port inspection found no listeners on 10136/10137/10138. The preserved worktree database was not stopped.

**ALL WRITING/PROCESSES STOPPED.**
