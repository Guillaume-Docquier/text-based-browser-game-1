# Increment 01 independent review, round 1

## Verdict and reviewed snapshot

**Actionable findings: R1, R2, R3 (P2). This snapshot does not satisfy the approved v1 contract.** R1 and R2 are demonstrated correctness defects; R3 is a concrete shared-package maintenance/plan-alignment defect. Passing suites below do not cover these cases.

Reviewed only `C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1`, branch `codex/fleet-operations-experiment`, HEAD/base `acde251d2fb2164eb7cd881fb55fc5f08e52d817`. Git root, branch, HEAD and status were verified before and after review. Changes remain uncommitted. No source, tests, migrations, product documentation, Git administration, environment values or run-state were edited.

The reviewed tracked/untracked production, test and documentation manifest contains 89 files. SHA256 of sorted `SHA256 relative-path` lines joined by LF: `E572FF705C44760DCFF8123DA9268BA040EE30722E383545A34308D1E19F7014`. Paths come from the union of `git diff --name-only <base>` and `git ls-files --others --exclude-standard`, filtered to `apps/`, `packages/`, `docs/`. This verdict applies to that snapshot, not subsequent edits.

These independent conclusions were recorded before consulting prior implementer/tester/orchestrator verdict narratives. The authoritative requirements and approved v1 increment packet were primary inputs. No prior report was used as correctness evidence.

## R1 — P2: reject corrupt historical movement selections before continuation

**Location:** `packages/shared/src/action-submission/evaluateActionSelection.ts:692` (movement binding checks through line 705); supporting schema boundary `packages/shared/src/domain/world/fleets/Fleet.ts:25` and `:69`.

The journey check verifies owner, action-pool membership, definition binding and presence of a movement effect. It never verifies the captured submission's declared target/input shape, mapped destination against the live destination, or a future departure turn. `FleetMovementSchema` accepts the generic SubmittedAction record shape, including empty selections; FleetSchema only adds tuple-presence and owner agreement. Consequently a malformed captured selection survives parsing and authoritative validation and the ordinary movement phase advances it successfully.

**Independent reproduction:** using native TypeScript via stdin to `pnpm exec node --input-type=module` in `packages/shared` (exit 0), construct a ruleset with the existing test `MoveFleetStandard` and pool IDs A/B; owner `00000000-0000-4000-8000-000000000011`; owned source strength50 at origin(0,0), destination(4,0), another planet(2,0); Influence20/Fuel20. Submit A with `{fleet:'source',planet:'destination'}`, `{strength:50}` and resolve turn1. This succeeds, deletes the historical source, and creates child `15ccaa5b-e87b-58e7-87a9-13260cbb2487` at distance3.9. Replace only its movement provenance with the same speed/owner/action/definition but `departureTurn:99`, `selectedTargets:{planet:'wrong-destination'}`, `selectedInputs:{}`. `FleetSchema.safeParse(corruptFleet).success` is **true**. Resolve turn2 with no submissions: **Success**, remaining distance **3.8**, continuation outcome carries the invalid selections and departureTurn99. The live destination still points to the original destination.

The captured mapped source and selected force are absent, captured destination contradicts actual travel, and provenance says departure happens after this turn. This is data corruption, not a valid gameplay prevention. The worker's load parser cannot reject it, and resolution perpetuates it rather than reporting failure. No new submission or repayment is necessary to trigger the defect.

**Contract:** approved packet movement persistence/lifecycle sections require departure selections and consistent journey data, “reject partial/corrupt states at load” (line155), and “Corrupt continuation is data/engine failure” (line175); I1-13 and requirements Movement persistence bullet. ADR027's domain-schema boundary also informs the required validation seam. I1 deliberately allows a deleted full-departure source as historical provenance; validating historical mappings must not require that source entity to remain present.

**Bounded correction:** validate the captured selection's declared roles and positive safe-integer input, its destination binding and temporal provenance using the ruleset/current turn before mutation. Keep historical validation separate from charging or allocating a new departure. Preserve stored speed rather than comparing it to mutable seeded content. Add public resolveTurn/reload regressions for malformed selections and mismatched destination/future provenance, alongside the valid deleted-historical-source control.

## R2 — P2: candidate legality depends on action-ID ordering

**Location:** `packages/shared/src/action-submission/evaluateActionSelection.ts:191` (candidate issue filtering); `:653` (running strength budget issues).

Proposals are sorted canonically. The strength ledger assigns an overcommit issue only to the proposal that first crosses the source's budget. `evaluateTargetCandidate` then discards issues attached to other actions. A draft that sorts before an existing reservation therefore appears to have an eligible source even though its proposed force cannot fit. Renaming/swapping the action IDs changes candidate legality without changing the mechanics.

**Independent reproduction:** same native runner/fixture as R1, source strength50, adequate resources, two authorized pool instances A/B of the same definition. Retain submission B reserving50. Draft A has destination selected and `{strength:1}`; evaluate source candidate via `evaluateTargetCandidate` with targetTag `fleet`, targetId `source`. Result: overall **INELIGIBLE**, candidateStatus **ELIGIBLE**, sole `INSUFFICIENT_STRENGTH` issue attached to **B**, message reserves51. Swap only IDs (retained A/draft B): overall **INELIGIBLE**, candidateStatus **INELIGIBLE**, issue attached to draft B. Both native probes exited 0. With retained A reserving50 and an empty strength input for draft B, the source candidate also remains ELIGIBLE despite available strength0.

**Consequence:** `apps/frontend/src/features/play/components/TargetPicker.tsx:87` filters actual choices by candidateStatus and offers the overcommitted source in the first case but hides it in the second. `ActionCard.tsx:162` displays issues attached to its own action, so the affected draft can lose the concrete overcommit explanation when it sorts earlier. Overall evaluation still rejects submission; this finding does not claim that the API accepts excessive force. It concerns the mandated candidate/partial-state decision and feedback.

**Contract:** I1-01 candidate legality, I1-02/03 aggregate allocations and replacement, I1-06 exhausted sources, packet evaluator section (line129) requiring candidate-specific invalidity through the same ledger, and hard requirements2/3. Canonical traversal is appropriate for deterministic allocation but incidental identifier order must not change whether the proposed source is affordable.

**Bounded correction:** make candidate source legality reflect retained commitments excluding the edited instance and the proposed force, independent of which proposal crosses a sorted running ledger. An absent downstream slot should not reject an otherwise available source; a completely reserved source cannot support any positive allocation. Keep this decision in the shared evaluator. Add identifier-order/permutation tests and a fully reserved source with blank force.

## R3 — P2 maintenance: retained public validation/resource helpers remain alternate decision engines

**Location:** changed `packages/shared/src/action-submission/validation/targets/validateTarget.ts:65`; callers at `validation/targets/validateTargets.ts:70`; independent resource engines at `validation/costs/validateCosts.ts:17` and `getUncommittedResources.ts:27` (paths relative to `packages/shared/src/action-submission/`).

The approved plan explicitly says “old wrappers must delegate, never duplicate” (line129), “Reconcile getUncommittedResources.ts too” (line24), and implementation step2 calls for “delegating old validation/resource helpers” (line180). Only validateSubmittedActions delegates. The exported old target traversal, ownership/type checks and resource subtraction paths remain separate. New stateful target constraints were added to validateTarget as unconditional STATE_REQUIRED errors, so the retained API no longer validates supported movement correctly even though validateTargets receives full TurnState.

**Independent reproduction:** native runner (exit0), the valid R1 fixture with A selecting source/destination and strength20. Call both validators on exactly the same ruleset, submission and TurnState. `validateSubmittedActions(...)` returns **[]**. `validateTargets(...)` returns Success containing **two issues**, each “This constraint requires the complete state supplied to the shared eligibility evaluator”. Thus the legacy path rejects an eligible movement. The cost helper additionally keeps its own per-action resource reset/subtraction loop while the new evaluator maintains aggregate commitments; getUncommittedResources keeps a third subtraction/assertion loop.

A search restricted to application/shared source found no current production callers of these legacy helpers; target/cost tests still exercise the independent old paths. These functions remain publicly importable through the shared package's wildcard action-submission export. This is not a current UI/API/resolution dispatch defect or a request to redesign unrelated mechanics. It is a demonstrated conflicting package interface and the expressly forbidden duplicate decision maintenance: future fixes must update several engines, and their green old tests do not establish agreement for the now-supported constraints.

**Bounded correction:** remove obsolete helpers/tests if compatibility is unnecessary, or adapt their interfaces/projections and delegate to the authoritative evaluator with sufficient state. Retain only genuinely lower-level predicates shared by that evaluator. Do not introduce a second full evaluator or unrelated generic framework. Verify retained public entry points agree on a valid movement and aggregate resource reservations.

## Full review scope and other conclusions

Read root/scoped AGENTS, reviewer persona, requirements, full approved I1 packet, TypeScript standards, glossary, installed tools-ts README, ADR index and relevant accepted007/008/011/013/015–031, turn-resolution/turn-processing architecture, GDDR index/009 and Systems index/001/003/008/010/011/012/014/015. Read Storybook workflow skill and installed Storybook guidance before executing the suite.

Reviewed the complete tracked and untracked production/test/documentation increment against base, including the untracked migration SQL/snapshot, shared evaluator/input/constraint schemas, parity fixture and movement suite, backend concurrency/unit tests, and ActionCard stories. Reviewed surrounding target/cost/resource helpers, effect construction, fixed phases, turn closure/locking, persistence mappings and game-start action creation. Read affected Playwright helpers/specs without executing them.

Specific checks covered:

- UI/API/resolution actually invoke the shared evaluator with normalized players, full fleets/origins/planets, resources and retained actions. Inputs, safe-integer boundaries, extra slots, arbitrary mappings, prototype-named tags, dependent inclusive range/origin rejection and schema-invalid compositions were inspected. No movement behavior branches on Standard/Test action IDs, names, tiers or labels were found.
- Replacement excludes the edited instance; cancellation releases reservations. Scoped reads and no-key-update locking occur in the transaction on the real turn row before authoritative reservations/closure decisions. PostgreSQL overlap tests exercise force/resource and readiness/deadline races.
- Deterministic child creation happens for all departures including full force; shared removal IDs reach worker deletion. Movement snapshots old journeys, advances old/new journeys once per turn, charges only new costs, clears arrival data, merges into the friendly stationed survivor and preserves ordinary hostile co-location. No automatic ordinary combat was introduced.
- Busy binding prevents submit/edit/redirect/null cancellation, separate same-definition instances remain usable, and full departed sources are historical references. Partial tuple and duplicate occupancy checks exist; R1 identifies incomplete corruption coverage beyond those checks.
- Transient continuation outcomes and departure provenance stay separate from newly locked submissions. Fixed phase order and native TypeScript/Result/package/app boundaries remain intact. SQL adds only nullable selected-input/movement JSON fields; no backfill or outcome-history feature was added.
- Tests generally use concrete independent expected strengths, costs, destinations, identities and outcomes; parity tests traverse actual projections/public seams. However candidate-ID permutations and corrupted captured selection bindings are missing, as shown by passing suites despite R1/R2. Older helper tests conceal R3 by testing the separate legacy subset.
- Affected existing architecture/System/glossary/index documents correctly keep Assault/Colonize/deferred arrival intent partial or later work. No settled game-design scope was reopened. Beyond R3, no actionable unnecessary-abstraction or speculative-generalization finding emerged from the current mechanics.

## Verification actually executed

All commands used the authorized linked worktree with an explicit workdir and normal-account require_escalated route. Completed processes were followed through exit.

| Command / check                                         | Exit | Evidence                                                                                                                                                          |
| ------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git root, branch, HEAD, status                          | 0    | Authorized checkout/branch/base verified                                                                                                                          |
| `git diff --check`                                      | 0    | No whitespace errors                                                                                                                                              |
| `pnpm --filter shared test`                             | 0    | 25 files, 134 tests                                                                                                                                               |
| `pnpm --filter backend test --project unit`             | 0    | 2 files, 6 tests                                                                                                                                                  |
| `pnpm --filter backend test --project integration`      | 0    | 6 files, 95 tests                                                                                                                                                 |
| `pnpm --filter backend test --project concurrency`      | 0    | 2 files, 4 tests; actual Testcontainers PostgreSQL18.4; fresh migrations applied by API boot                                                                      |
| `pnpm --filter frontend storybook:test`                 | 0    | 15 files, 52 tests, Chromium                                                                                                                                      |
| Exact Drizzle migration chain in fresh in-memory PGLite | 0    | Native stdin script used drizzle/pglite migrator with `migrationsFolder:'drizzle'`; two migration rows and nullable JSONB actions.selected_inputs/fleets.movement |
| Native public-function probes described in R1–R3        | 0    | Demonstrated passing corrupt continuation, identifier-dependent candidate legality, conflicting legacy target validation                                          |

PGLite was not used as evidence of serialization. PostgreSQL concurrency output and harness source were inspected separately. No shared/main database was reset, and no environment value was changed.

## Limitations and handoff

No environmental limitation blocked this review. I did not rerun lint, package/root typechecks, frontend build, Storybook build or affected E2E specs, and did not perform manual live-app visual QA. Their approval gates remain mandatory; the suite results above are not a blanket claim that all I1 gates passed. Storybook browser component tests were executed; E2E code was read only.

Only this assigned report was written and formatted. Root owns disposition, implementation routing, fresh follow-up review and acceptance. R1–R3 require disposition before acceptance of this snapshot.
