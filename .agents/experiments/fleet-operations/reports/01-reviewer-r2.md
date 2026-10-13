# Increment 01 independent review, round 2

## Verdict

**One actionable finding: R2-01 (P2). The current full increment is not ready for acceptance until saved-route integrity is corrected.** No other actionable correctness or architecture finding was established in this review.

Reviewed checkout: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`, branch `codex/fleet-operations-sol`, HEAD/base `aa9272ec2b9ac756aa5d606bca900875ff9f58ed`. The implementation remains dirty. This review uses the unchanged v1 approved acceptance packet, requirements and live implementation. Prior worker/reviewer/orchestrator reports and the run-state confidence narrative were not read.

## R2-01 — Validate saved route/progress before overwriting remaining distance

- **Priority:** P2.
- **Location:** `packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts:108` (route-derived progress, lines 108–113); related saved-binding validation at lines 27–57 and fleet parsing at line 68.
- **Contract:** A1-13 requires malformed journey corruption to fail; A1-14 requires typed failure for corrupt saved references. The approved continuation/persistence contract retains origin, destination, remaining distance, initiating turn and saved speed, and advances once by `min(saved speed, remaining distance)`. Legitimate changed current definition speed/range and disappearance of a fully allocated source are explicitly allowed.

**Trigger and observed result:** Use `createFleetEligibilityScenario()` with source50, speed2 and distance5. Resolve X20 on turn1: source30, child20, remaining3. JSON-reload the fleet through `FleetSchema`, then resolve turn2 with no submissions. Two independently executed variants both passed schema parsing and returned `Success`:

1. Change the saved journey's `originPlanetId` to its destination ID while leaving its recorded destination, submission, speed, initiating turn and remaining3 intact. Turn2 immediately lands the child at the destination and makes X available (`X/Y/Z`), instead of returning typed corruption failure. The original valid journey would still have remaining1 and occupy X.
2. Change only saved remaining3 to0.5. Turn2 returns a moving child with remaining1: the resolver increases the stored remaining distance, rather than rejecting inconsistent saved progress. Its available instances remain Y/Z.

The binding checks protect definition/pool/mappings/destination/child identity, but do not check the origin/progress relationship. The continuation code calculates a new remaining value from current route geometry and elapsed turns, discarding the persisted `distanceToEnd` without validating it. As a result, inconsistent saved state can cause early arrival and premature instance release, or make a fleet move backwards. The worker can persist that successful result.

**Required correction:** Validate saved route/progress consistency before departures or journey mutation, returning the existing typed resolution failure for inconsistent metadata. Preserve the intended numerical-arrival behavior and saved-speed continuation; do not reapply current departure ownership/range/strength predicates or require the exhausted source to exist. Add independent regressions for altered existing origin and inconsistent remaining distance, including JSON reload, plus the legitimate changed-definition/full-allocation controls.

The independent read-only probes used the real exported `resolveTurn`, `FleetSchema` and `computeAvailableActions`, not private helpers or a reimplemented movement algorithm. They ran through `pnpm exec node --input-type=module -e ...` from `packages/shared` and exited0. A preliminary probe had a reviewer guard using the wrong Result tag capitalization; it was corrected before the successful reproductions above and was not a product failure.

## Complete inspected scope

Inspected the complete gameplay increment from the supplied base: all 84 tracked implementation/test/documentation paths in `git diff --name-only` after excluding the orchestration ledger, and all 20 untracked implementation/test/config/migration files. The approved untracked increment packet was also read. Untracked prior reports/images were intentionally excluded to preserve independent context. Three ruleset files listed by working-tree status have only line-ending noise and no logical diff.

- Shared domain: ActionDefinition/input tags and definitions, mapping/constraint schemas, Move definition/factory/stub, Action/selection schemas and stubs, Fleet/FleetMovement, planet distance helper, independent Test Ruleset and each modified action definition.
- Shared eligibility: full new evaluator, commitments, replacement, occupancy, draft/complete/candidate/set behavior and scenario stub; availability; retained validation adapter; every removed validator/accounting file and its removed tests. Reviewed the new eligibility, independent boundary and persisted-journey tests in full, plus changed availability/validation/Move/resolver tests and the new Result extraction helper.
- Shared resolution: complete departure effect and saved-journey phase, canonical ordering/identity/names, zero cleanup, friendly merge, terminal release, Build adjustment and target resolver documentation. Inspected surrounding `resolveTurn`, phase/payment/effect interfaces and domain state used by these paths.
- Backend: request union/stub, actual submission and view use cases, complete locking/replacement and projection call sites, repository load/update mappings, worker and turn repository load/save/delete/action regeneration, named API contract additions, schema changes and auth parameter cleanup; Standard content and CoreRulesets tests. Inspected full new router/concurrency tests and FleetActionsScenario support, changed existing router/TurnProcessor tests, and real-PG harness extension. Existing turn-row lock, deadline, readiness and processing surroundings were inspected.
- Migration: SQL, journal and the entire generated snapshot compared structurally with the previous snapshot. Only nullable JSONB `actions.selected_inputs` and `fleets.movement` were added; other table metadata and non-table sections were unchanged apart from snapshot identity.
- Frontend: actual `toActionEligibilityState`, ActionCard/ActionSelector/TargetPicker, SearchSelect change, mutation invalidation, complete new ActionCard stub/stories, Fleet stories, all changed POMs and the complete fleet browser spec. Inspected root/frontend compiler configurations including the new Playwright project and its inherited app settings.
- Documentation: every changed turn architecture/System/index/glossary file. Required root/scoped instructions, coding standards, installed tools-ts README, ADR index and accepted007/008/010/011/013/015/016/017/018/020/022/023/024/025/026/027/028/029/030/031, turn architecture guides, GDDR index/009, and Systems index/001/003/008/010/011/012/014/015 were read in bounded chunks; truncated portions were subsequently completed. Requirements supersede the old System008 colonization design, which is outside this increment.

## Findings from the remaining review

The actual frontend candidate/complete paths, locked API proposed-set evaluation, and resolver prevalidation delegate to the same shared evaluator. Resource presentation and strength maxima use shared commitments; edits exclude the matching player/instance, and mutation success invalidates the authoritative view. Source candidates remain selectable despite stale dependent destinations or excessive old numeric drafts. Numeric edits remain local, cancellation works during invalid editing, dependent destinations clear on source changes, and turn/server-selection changes reset drafts.

The API locks the collecting Turn before reading resources/submissions/world context and writes inside that transaction. Game-scoped entity loading includes source origins and current transit state. Occupancy is keyed by player/instance, not definition, and is checked before missing current action rows. Selected inputs and movement fields round-trip; arrival explicitly clears movement fields, deleted source/merged fleet IDs are removed, and next-turn generation excludes surviving occupied instances.

Departure allocations are materialized canonically before any movement; the stationary remainder retains identity, children are deterministic, costs apply to new submissions only, each journey advances once, and terminal positive-friendly merging preserves the stationed survivor. Current effects complete without leaving continuation effects unresolved. The tested saved-speed/full-source-disappearance path is legitimate and must stay supported when R2-01 is fixed. Ordinary Move has no combat/ownership effect.

The new numeric inputs are consumed through validated mappings; supported source/range constraints and one-Move composition are checked at the schema boundary. No action-ID/name/tier/literal-tag behavior branch was found in production decision paths. The deleted independent accounting/validation paths are replaced by the common evaluator rather than duplicated in apps. No unnecessary new service or speculative workflow abstraction, or concrete missing generalization, warranted an actionable finding.

Coordinated20-tick arrival chronology, provenance/pending arrival effects, Assault and Colonize remain later scope. They were not required prematurely, and the moved automatic-continuation/partial/occupancy/basic-merge/release criteria were retained in this review.

## Independent verification

| Check                                                                                       | Result                                                                |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `pnpm --filter shared test`                                                                 | Exit0;21 files/116 tests passed.                                      |
| `pnpm --filter frontend storybook:test`                                                     | Exit0;15 files/54 tests passed, including native browser project.     |
| `pnpm --filter backend test --project unit --project integration fleetActions CoreRulesets` | Followed session60836 through explicit exit0;2 files/16 tests passed. |
| `pnpm typecheck`                                                                            | Exit0;root project.                                                   |
| `pnpm -r typecheck`                                                                         | Exit0;shared/backend/frontend, including Playwright project.          |
| `pnpm lint`                                                                                 | Exit0;zero-warning gate.                                              |
| `git diff --check aa9272ec`                                                                 | Exit0;only existing CRLF conversion notices.                          |
| Independent saved-route probes, including JSON reload and availability                      | Exit0;demonstrated R2-01.                                             |
| Generated migration snapshot structural comparison                                          | Exit0;only the two intended nullable columns changed.                 |

Applied repository Storybook skill and loaded installed `stories`/`write-story` guidance. Ran required help before docs/stories tooling, discovered actual components/story IDs through `docs list --withStoryIds true`, inspected `docs show` for ActionCard/SearchSelect and `stories changed`. Generated examples contained unresolved frontend imports, so the repository source/stories supplied the actual implementation review. Tool discovery/read commands exited0. No UI files were changed by this reviewer.

## Limitations and stopped handoff

This review did not independently rerun E2E, real PostgreSQL concurrency, all backend suites/coverage, frontend/Storybook production builds, or latest-head CI. Their actual tests/config/harnesses were reviewed, but another agent's green run is not asserted here as independent evidence. The focused integration run used production routers/repositories with PGlite; it does not prove PostgreSQL row-lock behavior. No live manual-browser visual session was conducted; Chromium Storybook interaction tests ran successfully. These are verification limits, not a clean all-gates verdict.

Only this assigned report was written and formatted with oxfmt. Production/tests/config/docs were read-only; no env values, Git state, commits, PRs or pre-existing servers were changed. All reviewer-started runtime processes exited, and no reviewer server remains running. Handoff is stopped for the orchestrator to route R2-01.
