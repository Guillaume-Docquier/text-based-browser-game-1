# I1 orchestrator plan approval

- Base: acde251d2fb2164eb7cd881fb55fc5f08e52d817.
- Approved packet: ../increments/increment-01.md, version 1; all I1-01 through I1-17 remain mandatory.
- Fresh planner: /root/increment01_planner, gpt-6.1-sol / medium, completed; only assigned plan written, formatted and whitespace checked.
- Review: coherent shared evaluator, arbitrary role mappings, dependent constraints and aggregate ledger, source snapshots, turn-row locking, deterministic split IDs, persisted ordinary journeys and per-instance occupancy, same-owner merging, backend/frontend coverage and named migration. Concrete Standard ranges 5/10/25 preserve live costs and speeds.
- Added ordinary lifecycle accepted because stationary-only eligibility otherwise strands slow moves. Composed arrival intents and Assault/Colonize competition stay with later increments.
- Clarifications resolved before approval: continuation outcomes are explicit transient shared results; no outcome-history tables. Full-departure source deletion must reach worker persistence (removed IDs or internal cleanup bookkeeping); final shared/player-visible state must contain no phantom zero-strength source. Historical journey source provenance can reference a removed original; a missing source in a new submission remains illegal.
- No accepted-ADR contradiction or unresolved product decision found. Scope follows requirements.md including superseded colonization decisions.
- Next: fresh implementer gpt-6-luna / max; one writer at a time. Test and full review independent/fresh, then orchestrator verifies current diff before commit.

## In-progress adapter findings (not a substitute for independent gates)

| ID      | Trigger and consequence                                                                                                                                                                                                                                                                                                                                                                             | Basis                                                                                                      | Owner/state                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| I1-O-02 | validateSubmittedActions.createEligibilityState uses submissionsById.get(action.id) as the entire authorized Action, replacing the pooled definition. Valid GainInfluence instance ID + known BuildFleet definition + valid planet/ample resources could be treated as authorized BuildFleet. Preserve original pooled definition and reject claimed mismatches; add initial-validation regression. | Hard shared authoritative validation; corrupt/initially illegal submissions fail before mutation; I1-01/08 | /root/increment01_implementer; pending fix/test evidence |
| I1-O-03 | validateSubmittedActions loops only known turnState.players, so a known-definition submission by an absent actor is omitted. Reject it before effects, and ensure issue projection cannot drop global/unassociated corruption errors.                                                                                                                                                               | Same authoritative validation contract and packet no discarded dependency errors                           | /root/increment01_implementer; pending fix/test evidence |

These were identified by reading the ongoing adapter draft, not by a completed acceptance run. Implementer owns changes; fresh tester/full reviewer still establish their own conclusions against the approved packet and final artifacts.

### Worker fix status

- I1-O-01: occupied-action null cancellation checked before write; API/independent proof pending.
- I1-O-02/03: implementer reports production corrections and regressions; focused shared typecheck and 3-file/15-test suite both exit 0. Independent gates/parent critical check required before closure.

### I1-O-04: corruption and production dependency checklist

- Owner: /root/increment01_implementer; pending correction/regression evidence.
- Current resolveTurn snapshots only fleets with movement defined, and validateMovementOccupancy skips movement undefined. Destination/distance fields without movement and no submissions must still fail authoritative resolution (I1-13). Confirm invalid bindings and duplicate owner/action occupancy also fail before effects.
- Current production validator imports Resources.stub.ts solely for absent-player fallback. Replace with the existing domain resources facility; test stubs do not belong in production dependencies.
- Routed during implementation; no independent test/review gate claimed.

### Corruption fix and persistence milestone (worker evidence)

- I1-O-04: implementer reports real zero-valued Resources fallback, partial movement-tuple validation before phases, and resolver regressions for partial data/duplicate occupancy. Focused tests passed (22); exact-optional-property type error corrected and rerun pending at that message. Independent verification still required.
- Fresh isolated PostgreSQL migration applied successfully per worker. First full backend integration run exited 1 (83/88 passed): API expectations and movement fixtures needed updating. Focused rerun underway; inspect final test changes/oracles at handoff.

### I1-O-05: API DTO oracle completeness

- Owner: /root/increment01_implementer; pending correction evidence.
- Three gameplay router comparisons currently broaden complete expected Action DTOs to objectContaining, leaving selectedInputs and isInProgress unverified. Keep explicit complete expected objects with null/empty inputs and occupancy flags.
- Completed-turn affordability may differ after costs are paid, but assert the exact post-spend state instead of dropping the flags from verification.
- Existing test adaptation must preserve useful coverage; this is not a substitute for the fresh test gate.

### I1-O-06: absent continuation actor (demonstrated)

- Owner: /root/increment01_implementer; pending production fix/regression.
- Basis: corrupt continuation must fail authoritative validation before phase mutation; I1-13 and I1-O-03 actor coverage.
- At current draft, validateSubmittedActions includes movement actor IDs but rejects absent players only by iterating playerSubmissions. With no new submissions the missing movement owner is never rejected. SUBMITTING_PLAYER_MISSING is declared but unused in the shared evaluator.
- Reproduction: use parsed createFleetStub with owner/submission player UUID absent from players, origin/destination planets present, TestRuleset MOVE_FLEET_IMPROVED_1 bound to MOVE_FLEET_IMPROVED, speed 1, departureTurn 1, selectedInputs strength 10, complete destination/distance 5; resolve turn 2 with players {}, submittedActions [], TestRuleset/createSeededRng.
- In-memory read-only command: pnpm --filter shared exec node --input-type=module -e [imports and fixture above], exit 0. Observed Result Success, distance 5 -> 4, and continuation outcome for absent actor. No files were written by reproduction.
- Required result: initial authoritative failure with unchanged state; add explicit regression. Routed without editing production/tests or bypassing independent roles.

### I1-O-06 targeted parent recheck

- After implementer correction, the same read-only in-memory missing-owner fixture returned Failure / INVALID_SUBMISSIONS with the absent-player explanation; entire state unchanged, distance remains 5.
- Command: pnpm --filter shared exec node --input-type=module -e [same fixture plus unchanged-state assertion], exit 0. The command sets a failure exit code unless result is Failure and state equals its pre-call serialization.
- This closes the targeted parent reproduction on that draft. Fresh independent test/full review and final-tree verification still remain mandatory; it is not I1 acceptance.

## I1-O-07: partial journey with no known actors (demonstrated)

- Owner: /root/increment01_implementer; pending fix/regression. Basis I1-13: corrupt initial continuation state must fail before effects, including turns without new submissions.
- validateSubmittedActions enumerates known players, new submitting players and complete movement payload actors. A partial tuple without movement and with players {} produces no actor iteration, so the shared global consistency check never runs.
- Read-only in-memory fixture: create two planets at (0,0)/(5,0); parsed stationary strength-10 Fleet owned by UUID absent from players; spread it with destinationPlanetId and distanceToEnd:5 but no movement. createTurnStateStub({turn:2,players:{},submittedActions:[],planets:{...},fleets:{...}}); resolveTurn(state,TestRuleset,createSeededRng()).
- Complete command `pnpm --filter shared exec node --input-type=module -e [fixture]` exit 1. Observed Success with malformed Fleet preserved and unchanged true. The command asserts Failure plus unchanged input. On Windows the script was flattened into one argument before invoking pnpm; an earlier multiline invocation returned no diagnostic and was not evidence.
- Required: shared journey consistency cannot be skipped by empty actor enumeration; add exact no-known-actor/no-new-submission regression. Routed to the current sole writer, no root production/test edits.

### I1-O-07 targeted parent recheck

- Worker included actors from every Fleet with any journey fields, keeping the actual consistency predicate in evaluateSubmittedActions, and reports resolveTurn suite exit 0, 10/10.
- Parent reran the exact flattened in-memory fixture, command exit 0: Failure / INVALID_SUBMISSIONS with incomplete movement explanation, full input unchanged. Diagnostic uses unassociated validation provenance rather than an actual payable submission.
- Targeted reproduction closed on this draft. Fresh test/full review and final-tree verification remain pending.

## I1-O-08: inherited dictionary name accepted as numeric input (demonstrated)

- Owner: /root/increment01_implementer; acknowledged, fix/regressions pending. Basis I1-07: undeclared inputs must fail initial validation.
- Known GAIN_INFLUENCE_1 / GAIN_INFLUENCE instance, valid current owner/resources, no targets, selectedInputs { constructor:1 }; definition inputs is {}. evaluateActionSelection returns ELIGIBLE with no issues because its undefined-entry check sees the inherited Object constructor as an input definition.
- Read-only flattened Node fixture command `pnpm --filter shared exec node --input-type=module -e [fixture]` exit 1, expected INELIGIBLE and UNEXPECTED_INPUT for constructor. Actual resource commitments zero, no other invalid state, isolating the undeclared-slot decision.
- Required own declared entries, preserving arbitrary legitimately declared tags. Add constructor/toString shared regressions and API transport rejection evidence where encodable. Inspect analogous target/entity/definition dictionary membership within this decision path for the same concrete issue; avoid unrelated hardening/refactoring.
- No root production/test edits. Fresh independent roles remain mandatory after implementation handoff.

### I1-O-08 targeted parent recheck

- Worker reports own-key declaration guards, shared evaluator/validator run exit 0 (22 tests), backend inherited-key transport run exit 0 (2 tests), and shared/backend typecheck exit 0.
- Parent reran the exact flattened, read-only Node fixture after the correction. Exit 0; status INELIGIBLE, UNEXPECTED_INPUT on constructor, no unrelated issues and zero commitments.
- This closes the targeted reproduction on the current draft. All acceptance, independent testing and full review still remain pending.

## I1-O-09: inherited source dependency for an arbitrary declared tag

- Status: demonstrated on the current production tree; pending implementer handoff after tester r1 stops writing. Root makes no production or test fix.
- Contract: I1-05 missing source is dependency-incomplete; I1-08 and hard architecture requirement 1 support arbitrary declared target/input mappings.
- Location: packages/shared/src/action-submission/evaluateActionSelection.ts, WITHIN_FLEET_RANGE and DIFFERENT_FROM_FLEET_ORIGIN branches read selectedTargets[sourceFleetTag] directly.
- Trigger: valid ActionDefinitionSchema-parsed movement definition with declared Fleet source tag constructor, destination tag landingSite, numeric input units and corresponding effect/constraint references. Draft selects destination only and units 1, leaving constructor absent in a normal {}-based selections object.
- Actual: INELIGIBLE with two DEPENDENCY_INVALID messages referencing function Object() { [native code] }, plus MISSING_TARGET constructor.
- Expected: INCOMPLETE with MISSING_TARGET constructor and DEPENDENCY_INCOMPLETE landingSite, no inherited-property source binding. Complete legitimate declarations of such tags must still work.
- Read-only command: pnpm --filter shared exec node --input-type=module -e using a flattened single-line source in the requested packages/shared directory, require_escalated. Completed exit 1 from explicit expected-result assertion, not a tool/setup failure. State otherwise unchanged: commitments Influence3/Fuel1, no strength committed, source available50.
- Fixture: owner00000000-0000-4000-8000-000000000077; source...078 strength50 at origin...079 (0,0); destination...080 (3,4), unclaimed. Resources Influence10/Metal10/Fuel10/Energy0/Colony0. Clone TestRuleset MOVE_FLEET_STANDARD, rename definition ARBITRARY_TAG_MOVE and add pool/action ARBITRARY_MOVE_1; rename target mappings and both dependent references to constructor/landingSite and numeric mapping to units. Parse definition before evaluating.
- Replay script is retained in session store fleetArbitraryTagPartialCommand; durable fixture and location above suffice to reconstruct without production edits.
- O-09 related boundary inspection: ActionCard also uses direct selectedTargets[tag] in its single-choice-default/read path and selectedInputs[tag] in its input read path. These normal {} objects inherit constructor/toString. The implementer should inspect affected shared/UI selection lookup boundaries, preserve legitimate declared tags, and test partial/default versus complete behavior; root has not changed production/tests.
- O-09 positive control: same parsed definition/state with own constructor:sourceId selection completed exit 0, ELIGIBLE/no issues, strength commitment1/remaining49 and Influence3/Fuel1. This proves the declaration is valid and the observed defect is specifically missing dependency lookup, rather than malformed content or fixture setup.

## Tester r1 handoff and implementation fix r2

- Tester r1 stopped all writes and reported full test gate FAIL in increment-01-tester-r1.md. Its current suites/builds/static checks pass; mandatory evidence gaps I1-04 third3Influence/1Fuel rejection and I1-16 Exceptional range25/configured tier speeds remain.
- Existing implementer is now sole writer, preserving all tester additions and approved v1. Assigned increment-01-implementer-r2.md; root O-09 and both tester gaps routed. No fresh reviewer before test gate.
- Root criterion map inspection additionally identified I1-10 backend evidence gap: current worker test reloads a speed1 journey for departure plus one automatic continuation, but does not explicitly prove two successive automatic reloads or one-time costs/binding. Routed test evidence closure using a legal fixed-seed variant: known1.1456435045942517 route at speed0.5 gives literal remaining0.6456435045942517 then0.1456435045942517 then arrival; select20, reload each time, persist speed/departure/submission and assert post-departure3Influence/1Fuel spend never repeats. Shared retains exact speed2/distance5 vector. This is an evidence gap, not a claimed production bug or plan/scope change.

### Fix r2 bounded plan approval

Existing implementer reverified exact root/branch/base and preserved the diff. Root approved its correction proposal within unchanged v1: own-key shared/UI partial/default/complete lookup; Exceptional25/25.001 shared/UI plus actual router range bands; resolveTurn actual shipped/test speed definitions; speed0.5 three-resolution persistence variant; resource-only third order using20+29 from50 followed by third strength1 (one strength still free, budgets6/4 exhausted) and exact BAD_REQUEST/unchanged state, retaining the exact20+30 parity case afterward. This avoids a force-exhaustion-only rejection being mistaken for resource proof. Independent tester/full reviewer still mandatory.

### O-09 targeted parent recheck after fix r2

- Exact stored read-only flattened Node partial reproduction completed exit0: INCOMPLETE, MISSING_TARGET constructor and DEPENDENCY_INCOMPLETE landingSite, no inherited invalid binding, source remaining50.
- Exact complete positive control completed exit0: ELIGIBLE, no issues, strength1 committed/49 remaining, Influence3/Fuel1 commitments.
- No production/test files written by parent. This closes only the original shared reproduction on the current draft; UI regressions, gap closures, fresh full tester/reviewer and stable-tree acceptance remain mandatory.

## I1-O-10: fix r2 API test boundary and independent oracle

- Type: actionable test-quality corrections, not demonstrated production bug; routed to current implementer before its handoff.
- Location: gameplay.router.integration.test.ts, new Exceptional range/shipped speed scenario and StandardMovementVerificationRuleset.
- Its fixture spreads backend StandardRuleset for API game setup, contrary to backend AGENTS and approved packet stable Test Ruleset requirement. Use Test-derived fixed variant for actual router state; verify official Standard catalogue values separately at a suitable content/contract boundary or documented source inspection without coupling generic API setup to changing official content.
- Speed assertions compute distanceFromOrigin(destination)-speed, duplicating movement arithmetic. Select fixed seed planets and use literal expected remaining distances for0.1/1/5. Geometry is acceptable for fixture range-band identification, not as the expected movement implementation. New integration scenario also needs mandatory AAA sections.
- Bounded test correction; keep existing range/UI/shared evidence, actual router setup and no environment changes. Affected reruns then fresh full tester/reviewer remain.

### I1-10 exact cost fixture correction before r2 handoff

Parent read found the new slow worker variant used Improved3Influence/3Fuel. Routed a narrow fixture change to speed0.5 Standard3Influence/1Fuel to match the approved vector, keeping actual Improved build100/source80 remainder and force20. Expected full balances are literal: initial100/100/100, post-build I94/M97/F100/E0/C0, post-movement I91/M97/F99/E0/C0 with equal uncommitted totals and both continuation turns unchanged. Existing separate configured-speed router scenario retains Improved3/3 coverage. This is test evidence correction only; no production bug or plan revision.

## I1-O-11: client callback order is not PostgreSQL mutation order

Status: actionable test-oracle finding sent to the current independent tester r2 (test/support scope); no production bug claimed.

Location: apps/backend/src/api/gameplay/gameplay.concurrency.test.ts, cancelReplaceCompletion and expectedCancelReplaceStateByMutation (approximately lines150–199).

Trigger and consequence: simultaneous cancel and replace calls use the same ApiClient httpBatchLink. The test chooses the persisted winner from the order in which client promises complete. That is not the turn-row transaction commit order. A legal replace-then-cancel database result can therefore fail an expectation that chooses replace merely because its client callback ran last; a pass also does not establish the asserted ordering.

Evidence: apps/backend/src/tests/ApiClient.ts constructs httpBatchLink. Installed @trpc/client11.18.0 dist/httpBatchLink-CaWjh1oW.mjs dispatch maps a returned batch result by request index and resolves those client items after the complete batch response. This supplies no per-transaction commit-order evidence.

Required correction: assess the oracle independently and use the exact observable valid serialized outcomes with coupled selected targets, inputs and resource state, or a legitimate production seam establishing ordering. Preserve genuine real-PostgreSQL start gates, lock/budget assertions and router-only state setup/observation. Do not replace the oracle with an uncorrelated count or broad success assertion. Root does not edit tests. Fresh full review and root acceptance remain required.

Tester r2 disposition: confirmed O-11 and removed callback-order inference. The oracle admits only complete serialized tuples: cancellation with null/null and exact released commitments, or replacement with mapped targets/strength19 and exact reserved commitments. Both overlapping mutations must succeed; other start-gated real PostgreSQL budget/closure proofs remain. Corrected focused gameplay concurrency suite completed2/2, exit0. An earlier malformed pnpm argument invocation did not execute the intended test and is not counted. Root accepts this bounded test-only correction as addressing the false inference; independent full reviewer still assesses the final entire increment.

## Independent critical execution on tester-r2 final draft

- Shared reservation/range/split/continuation checks: `pnpm --filter shared test src/action-submission/evaluateActionSelection.test.ts src/turn-resolution/fleet-movement.test.ts`, exit0, 2files/35tests. Inspected literal boundary (3,4)/(3,4.001), replacement/exclusion, deterministic partial/full departures, speed2 distance5 ->3 ->1 ->arrival and costs once. This precedes fresh full review and cannot accept later affected edits automatically.
- Real PostgreSQL critical checks: `pnpm --filter backend test --project concurrency src/api/gameplay/gameplay.concurrency.test.ts`, actual exit0, 1file/2tests, 11.99s. Root observed fresh migration/seeding, start-gated strength30/30 and20/30 budgets, resource-only race, exact legal cancel/replace stored tuples, persisted JSON journey binding/full-source deletion, readiness and deadline closure followed by actual worker capture. Expected rejected-request log entries are asserted outcomes. No PGlite lock claim.
- Storybook discovery: `stories changed` returned no affected stories despite the real UI diff; fallback `stories find-by-component` resolved all five ActionCard states and seven FleetsPage states across actual component consumers, exit0. Local review created with all12 states, exit0: http://localhost:6006/?path=/review/.
- Initial CLI screenshot of the review page timed out waiting for its heading, exit1; it supplies no acceptance evidence. Direct discovered story previews were then inspected using installed Playwright and public visible selectors; read-only inspection exited0 and root viewed all three captured PNGs. The occupied-state capture demonstrated O-12 below. Draft and actual journey table rendered; no blanket UI acceptance claimed.

## I1-O-12: occupied action displays an unrelated draft as its journey

- Status: demonstrated production/UI presentation defect; root makes no production/test correction. Route to existing implementer only after tester-r2 stops all writes, then fresh independent test pass and full review.
- Basis: I1-11 in-progress presentation and I1-17 occupied-card state matching backend; requirements usable strength/dependent-target/action-in-progress UI. This is not a new mechanic or scope decision.
- Location: apps/frontend/src/features/play/components/ActionCard.tsx, draft initialization/defaulting around88-122 and target/input/issues/allocation rendering around210-298. In-progress available instances have null current selections; the normal draft's single-choice defaults/evaluation/rendering are still applied even though the journey occupies the action.
- Reproduction: actual discovered application-action-card--occupied-during-movement story. Its persisted movement submission binds MOVE_FLEET_STANDARD_1 to northernFleet/Far Reach with selected strength20 and distance4. Another stationary Home Guard50 remains. Open http://localhost:6006/?path=/story/application-action-card--occupied-during-movement and inspect the rendered card.
- Observed: correct Far Reach/4ly banner, but disabled Fleet field displays Home Guard50; Planet says Choose planet, numeric force is blank, impossible missing-input/target errors and unrelated35-of50 reservation text appear, plus raw Action/Fleet-ID busy diagnostic. Actual journey is Northern Guard, not the auto-selected Home Guard. The player cannot correct these disabled fields.
- Evidence: reports/increment-01-root-ui-occupied.png, captured from actual same-worktree Storybook and viewed by root; accompanying browser body inspection corroborated text. Draft/table comparison captures are increment-01-root-ui-draft.png and increment-01-root-ui-journey.png. Read-only browser command actual exit0; no production/test files changed.
- Required bounded result: occupied presentation must represent the bound journey rather than fabricate a new editable selection/reservation or demand impossible inputs. Preserve arbitrary role mappings, current API occupancy rejection/shared eligibility, normal editable-state behavior, same-definition free instances, full-departure cases where the historical source no longer exists, and next-turn release. Implementer proposes the concrete rendering and regression changes within unchanged v1; tester/reviewer independently verify them.

### O-12 bounded correction approval

Existing implementer independently confirmed the captured mismatch and proposed a read-only journey presentation on the existing isInProgress lifecycle flag: match the current journey by owner/action binding, show actual current Fleet name/strength/destination/distance, and skip editable defaults/evaluation/reservation/error rendering for this already-running action. Historical source lookup is unnecessary, so full departures remain representable. Editable free instances continue using the same shared evaluator. Root approved this within unchanged v1, with no backend/shared mechanics change.

Required regression fixture is a realistic full departure with historical source absent, current child force20 and captured selected force20, plus a free same-definition instance. Story asserts the semantic occupied summary and absence of the real editable alternative/errors; free instance controls remain usable. Generic page-object observations/E2E assert actual force/destination/distance after departure and reload, then summary removal and source/filter/reuse availability after arrival. No hypothetical defensive UI, action-content branches, new reservations/payment or state-reset abstraction. Implementer-r3 is now the sole code/test writer; fresh tester-r3/full reviewer still mandatory after it stops.

### O-12 correction execution milestone

- Root reverified the requested root, branch and exact base SHA acde251d2fb2164eb7cd881fb55fc5f08e52d817 on 2026-10-11. No gameplay commit yet.
- The implementer reported two JavaScript patch-construction failures before any command/file mutation. It confirmed approval was received and no permission/environment blocker was pending; it corrected the wrapper rather than changing scope or requesting routine approval.
- Actual current source inspection confirms the bounded occupied lifecycle path, realistic full-departure/free-instance story, semantic journeySummary page-object locator, literal4-strength/0.8ly E2E observations after departure/reload and summary removal after arrival. Shared/backend paths are unchanged by this correction. Implementer reports four-file formatter-write exit0; validation is now running.
- No acceptance claimed from the ongoing draft. Implementer remains sole code/test writer. Fresh tester-r3, full reviewer-r1 and stable-tree root acceptance/commit remain pending.

### O-12 independent corrected visual recheck

Root opened the actual discovered occupied Storybook preview after implementer-r3 stopped, using installed Playwright in a separate read-only browser. Command exited0. The rendered occupied group contains exactly Northern Guard /20strength/Far Reach/4ly remaining, with zero comboboxes, numeric inputs, alerts or buttons and no new cost/allocation diagnostics. The adjacent free same-definition card completes a real legal selection through the story harness and displays Home Guard50/Waypoint/force1 with Update/Cancel controls. Root captured and viewed reports/increment-01-root-ui-occupied-fixed.png; the prior defective capture is preserved separately. This closes the targeted visual reproduction on the inspected source. Four affected-file SHA256 values are stored for final-tree accounting. Full fresh tester/reviewer/root acceptance remain pending; this is not increment acceptance.

## Reviewer r1 probes independently reproduced by root

On 2026-10-11, with the reviewer still completing its full read-only diff review and no source/test writer active, root independently executed native Node probes through real shared evaluator/resolver APIs. `pnpm exec node --input-type=module -e <read-only probe>` from packages/shared exited0. No production/test files changed.

Candidate fixture: Test-derived MoveFleetStandard; two authorized instances A/B; stationary owned source50 at(0,0), destination(4,0), ample100Influence/100Fuel. Keep the other action's force30 and propose force21 for the candidate source. Overall evaluation is INELIGIBLE in both cases. Candidate A reports ELIGIBLE with INSUFFICIENT_STRENGTH attached to retained B; candidate B reports INELIGIBLE with the issue attached to B. The only changed variable is which instance is the candidate. TargetPicker filters solely by candidateStatus, so this is observable candidate-selection inconsistency; total submission validation still rejects both.

Continuation fixture: no new submissions at turn2; journey20 owned by an existing player, origin(0,0), live destination(4,0), remaining3.9, persisted speed0.1, authorized instance A. A valid capture selects force20 from deleted-historical-source and selects the actual destination, departureTurn1. This control correctly returns Success and advances to3.8, proving full-departure history must remain permitted. Independently change only: (a) recorded targets/inputs to{}, (b) recorded destination to a different known Planet(2,0), or (c) departureTurn to3. Every malformed case also returns Success and advances to3.8; future provenance3 is preserved in resolvedContinuations. These are corruption validations, not changed gameplay choices.

Reviewer r1 reports the two probes as concrete P2 findings but its report/handoff is not yet complete. Root reproduced them independently and will route final actionable findings to the existing implementer only after the reviewer stops writing. Full current shared/unit/etc green tests do not waive these demonstrated defects. Approval v1/all17 remains unchanged, and no I1 commit is accepted.

Root separately asked the reviewer to disposition the approved packet's legacy-helper delegation requirement: retained validateTargets/validateTarget/cost/resource helpers currently duplicate separate decisions despite new production boundaries using the common evaluator. No classification or refactor approval is assumed before evidence/disposition.

## Full review r1 dispositions

Root read the complete reports/increment-01-reviewer-r1.md. It reviewed the entire89-file current source/doc manifest, separately from orchestration reports, and explicitly stopped all writes. R1/R2 correctness defects and R3 conflicting exported legacy interfaces/mandatory delegation gap are all accepted, with no speculative scope expansion. Existing implementer is assigned correction report increment-01-implementer-r4.md and must propose concrete shared validation/removal scope before acknowledgment. Any fix changes the reviewed manifest and requires fresh independent tester and full reviewer; tester-r3 PASS and reviewer-r1 green suite outputs do not accept a subsequent tree.

## Implementer-r4 proposal approval

Root approved the bounded R1–R3 approach after independent source inspection. Shared pre-mutation validation owns historical selection mapping/input shape, destination and force agreement; source history may be deleted and stored speed remains authoritative. Temporal check rejects strictly future departures (> current turn). Equality remains permitted because GetPlayerView evaluates COMPLETED post-resolution state, and winning TurnsRepository.saveProcessedTurn returns after ending the game without creating the next turn. A valid journey departing that final turn has departureTurn equal to the completed view turn; a strict global < check would falsely classify it. No context flag/duplicate adapter rule is needed. Existing historical and current-turn positive controls are required alongside malformed-state rejection.

Shared aggregate attribution/exhausted blank-source candidate check fixes R2, preserving exclusion and incomplete affordable selections. Removal instead of delegation for R3 is approved only for independently confirmed obsolete target(s)/cost/resource APIs, their dead evaluator support/tests, and stale resolver reference; authoritative useful coverage remains. This routine technical correction retains v1/all17 and requires fresh tester/full reviewer. Existing implementer is the only source/test writer; root writes experiment artifacts only.

## Independent current-tree R1/R2 correction replay

Root executed the actual shared evaluator and resolver through a native Node in-memory probe from packages/shared, with no production/test edits. Command pnpm exec node --input-type=module -e <probe> exited0.

- Twelve candidate permutations (candidate A/B, forward/reversed retained action order,30+21,50+1 and fully reserved50+blank) all report candidate INELIGIBLE with the insufficient-strength issue attached to the candidate. Two edited-instance controls correctly exclude the old20 allocation and keep a blank candidate selectable with20 available.
- Two continuation controls permit a deleted historical full-departure source and departureTurn1 or2 at displayed/resolved turn2. Persisted speed0.1 advances3.9 ->3.8 despite the current ruleset seed speed5; resources stay unchanged, no new resolvedActions appear, and exactly one continuation preserves capture/speed/departure provenance.
- Seven malformed captures (empty selections, different live/captured destination, extra target, missing input, extra input, selected force19 versus live20, and future departureTurn3 at turn2) return Failure with the entire input state unchanged.

Snapshot accounting at this replay: source/test/documentation union has99paths (89existing,10deleted); exact bytes manifest SHA256 DD23FBCD1EBECE4CBF5369E35AF93559599F04E068594E08519AC04528021792. Recipe: sorted unique Git changed paths against acde251d plus untracked under apps/packages/docs; path TAB uppercase file SHA256 or DELETED; LF-join without terminal newline; SHA256 UTF-8 text. Tester remains active only for final evidence/handoff. This replay closes the targeted reproductions on the inspected current source but does not waive the fresh full review or complete root acceptance.

## Current movement UI inspection during full review r2

Root discovered current Storybook IDs through find-by-component for ActionCard, ActionSelector, TargetPicker and FleetsPage (exit0), then created a local review with all13discovered states in two groups (exit0): http://localhost:6006/?path=/review/. Direct CLI previews (exit0): occupied-during-movement, committed-source-candidate-feedback, partial-movement-allocation and fleets-page/with-destination.

A read-only installed-Playwright browser inspection exited0 and closed the browser. Root viewed all three actual PNGs captured under reports/increment-01-root-ui-current-{occupied,candidates,journey}.png.

- Occupied card: Northern Guard /20strength/toFar Reach/4ly remaining; no comboboxes, numeric controls, alerts or buttons. Adjacent free instance renders Home Guard50/Waypoint/force1 with Update/Cancel.
- Current edited-candidate story: blank numeric force disables Update; excluding its own prior20 selection leaves20 ofHome50available alongside Northern30 andReserve12 options. This verifies the current edited-instance positive control. It does not independently claim a fully reserved source-negative UI fixture.
- Journey table: Vanguard/Bob/strength25/Earth(1:2:3)/Mars(4:5:6)/12.35ly. Existing table controls and links render correctly.

Storybook remains available from the assigned checkout. Source/test/documentation manifest is unchanged by these report images/local review metadata. This is scoped visual evidence, not complete increment acceptance; fresh full review and the unresolved PostgreSQL closure test still govern the handoff.

## Root r5 handoff scope and persistence inspection

Root read complete implementer-r5 handoff after explicit STOP. Exact source/test/doc manifest B2419106987231F8F63AF37E8A42DBA00FEC14094610F104F3127CB7461E2D27 contains99entries; comparison against the prior reviewed DD23... tree shows exactly the four approved correction paths. The domain action guard now accepts Action and filters normalized eligibilityState.actions with owner fields rather than claiming repository DTOs contain playerId. All other85existing files and10deleted entries remain unchanged. No independent final acceptance is claimed.

Read-only persistence inspection confirms explicit removedFleetIds propagate via TurnProcessor to game-scoped deletion, JSON journey fields update/clear as a complete tuple, and next-turn actions reset both selections to null. Current existing System statuses accurately mark ordinary movement partial while Combat/Colonization remain pending. Scoped rg over apps/backend/src, apps/frontend/src and packages/shared/src finds no remaining calls/imports of the removed independent validators. Initial broader default-sandbox rg attempted node_modules junctions and emitted access-denied errors; the corrected source-only search returned no matches (expected exit1), with no environment/quality blocker. Source/tests/docs untouched by root.

## Root current-tree verification during tester-r5 handoff

On 2026-10-11 root reconfirmed the exact assigned worktree, branch and unchanged HEAD/base acde251d2fb2164eb7cd881fb55fc5f08e52d817. No accepted gameplay commit yet. All source/test checks below correspond to the implementer-r5 tree; tester-r5 reports no edits so far.

- Independent critical shared execution: pnpm --filter shared test src/action-submission/evaluateActionSelection.test.ts src/turn-resolution/fleet-movement.test.ts, actual exit0, 2files/53tests. Covers live allocation/range/candidate/partial and complete ledger, deterministic split/continuation/merge behavior rather than relying on prior role confidence.
- Independent real PostgreSQL gameplay execution: pnpm --filter backend exec vitest run --project concurrency src/api/gameplay/gameplay.concurrency.test.ts --silent, actual exit0 after25.36s, 1file/3tests. Fresh database boot migrations, public reservation/mixed resource races and production live-worker readiness/deadline closure completed. Rejected submissions emit expected API transaction rollback diagnostics. The existing pg client-query deprecation warning is recorded, not a failing assertion.
- Installed Storybook guidance loaded; changed-story discovery returned no stories and unreachable-file hints, so root used the mandated component reverse-graph fallback. It returned all7ActionCard and7FleetsPage story IDs, including FullyReservedSourceCandidate. Verified listening port6006 PID5872 is the assigned checkout's node/Storybook dev server with exact-port.
- Published current visual review http://localhost:6006/?path=/review/, actual exit0, 3groups/14states including all new stories. Root then used installed Playwright Chromium for read-only rendered inspection, actual exit0/browser closed, without production/test mutations.
- Current occupied card shows only bound Northern Guard20 to Far Reach4ly and no editable controls/cancel; independent free card retains Home50/input1.
- Positive edited20/retained30 case: all Home50/Northern30/Reserve12 candidate labels remain offered, blank force,20available, disabled Update.
- Distinct fully reserved Home50 case: Home absent, Northern30 and Reserve12 present, Northern selected before opening picker; destination/force blank and Select disabled. Opening the existing combobox displays its options and clears the text field as expected; the selected-option checkmark remains.
- Partial interaction: Northern30, Far Reach14:0:0, force20 and10available, Update visible. Journey table shows Vanguard/Bob25/Earth toMars12.35ly.
- Preserved new PNGs increment-01-root-ui-r5-occupied.png, -candidates.png, -fully-reserved.png, -partial.png, -journey.png; root actually viewed the occupied, partial and fully-reserved images. Older evidence remains intact.
- Inspected corrected player-view guard: it filters normalized owner-correct eligibilityState.actions and accepts Action, avoiding the previous incomplete-DTO type predicate. Migration remains exactly two nullable JSONB additions selected_inputs/movement with app-provided values.

Fresh tester-r5 complete final report and STOP, then fresh entire-increment reviewer-r3 and root final diff/criterion/snapshot acceptance remain mandatory. These checks do not accept I1 or authorize its commit on their own.

## Tester-r5 final test-only snapshot accounting

Tester independently confirmed that partial journey-field and duplicate occupancy failure scenarios already exist in resolveTurn.test.ts; no duplicate scenarios were added and no production defect was demonstrated. It strengthened those two existing cases with complete Result.Failure(ResolveTurnError.InvalidSubmissions(...)) expected payloads and full input-state non-mutation assertions. The separate no-known-player corruption case remains intact.

Root read the final assertions and independently executed pnpm --filter shared test src/turn-resolution/resolveTurn.test.ts, actual exit0,1file/12tests. Exact current source/test/docs manifest is F2AB06BE0B19D19FFF68D831B820B9E92ED8801FB0E12080C7E663EB4F351166, still99paths. Comparison with implementer-r5 STOP B241... shows exactly one changed path: packages/shared/src/turn-resolution/resolveTurn.test.ts. All production, backend/frontend tests, migrations and gameplay documentation remain byte-identical; preceding current root53critical shared/3PostgreSQL/rendered evidence is accounted for, and the strengthened test file is now independently executed.

Tester reports final shared21files/130tests, resolver12, root/shared types, lint/diff exit0. It is finishing its own report; full final PASS/STOP, fresh reviewer-r3 and root complete acceptance remain pending. No accepted gameplay commit.

## Fresh full reviewer-r3 dispatch

Root read the entire completed tester-r5 report, all17criterion mapping, actual command/count/exit matrix and exact99path manifest. Tester explicitly PASS/STOPPED all writes. Broad executed current-production matrix: shared21/130, backend integration6/96, unit2/6, real PostgreSQL concurrency2/5, combined Storybook/native15/54, frontend/Storybook builds, full default12worker E2E21/21 with both Clerk setup and actual configured server cleanup, workspace/backend/frontend/shared types, lint, formatter-write and diff exit0. Final shared/resolver/types/lint/format/diff reruns account for the one test-only change.

Root matched F2AB06BE0B19D19FFF68D831B820B9E92ED8801FB0E12080C7E663EB4F351166 across99paths, with only resolveTurn.test.ts changing since implementer-r5. Root independent current execution53shared+3realPostgreSQL+12finalresolver and actual rendered5state evidence is recorded separately. No source/test writer remains.

Fresh /root/increment01_reviewer_r3 was spawned explicitly gpt-6.1-sol/high/fork_turns none. Persona, absolute worktree, branch/base, approved v1/all17criteria, authoritative scope, repository reading requirements and own-report-only scope supplied. It independently reviews the whole tracked/untracked increment versus acde251d, including relevant surroundings; no prior persuasive verdicts/finding narratives supplied. Assigned report reports/increment-01-reviewer-r3.md.

Tester is making only a report clarification/formatting: I1-14 correctly uses source50 with competing30/30 ->one30/free20; I1-09 points to actual phase/resolver split/permutation and PostgreSQL full-source deletion fixtures. This cannot change the source snapshot and does not substitute for the reviewer. Root owns subsequent finding disposition/implementer routing/fresh gates/final acceptance. Commit and next planner remain pending, with no acceptance claimed.

## Root final acceptance preparation for reviewed F2AB06... tree

This mapping records root's direct contract/code/test inspection and independent execution while fresh reviewer-r3 remains active. It is not an increment acceptance verdict. Approved v1/all17criteria remain unchanged; no source/test edits were made by root.

| Criterion | Root evidence                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I1-01     | Actual ActionSelector frontend projection, updateActionSubmission transaction context and validateSubmittedActions resolution projection all invoke shared evaluator with total resources, current authorized instances, retained selections and complete world dependencies. Shared parity fixtures cross actual frontend/API/resolution boundaries. Corrected backend view now filters full normalized Action objects. |
| I1-02     | Direct shared critical run covers50 with20+30 versus20+31 across instances/definitions; real PostgreSQL gameplay run independently proves stored budgets and non-mutating rejection.                                                                                                                                                                                                                                     |
| I1-03     | Shared replacement/cancellation ledger excludes only edited instance, with public router and actual positive edited20/retained30 candidate presentation; root rendered blank-force20available Update-disabled state.                                                                                                                                                                                                     |
| I1-04     | Resource ledger uses total pre-turn resources, combines distinct definitions and does not finance costs with same-turn gains; public PostgreSQL mixed-resource races pass and API resource values are protected by rollback.                                                                                                                                                                                             |
| I1-05     | Source-dependent finite range/no-op constraints share the actual planar model; exact5 endpoint/just outside/origin switch/coincident distinct/missing dependency are exercised in independent shared critical run and router/story fixtures.                                                                                                                                                                             |
| I1-06     | Shared invalid-source cases and game-scoped public router lookup cover enemy/missing/wrong-game/moving/missing-origin/exhausted. Root actual fully-reserved card excludes Home50 while Northern30/Reserve12 stay offered.                                                                                                                                                                                                |
| I1-07     | Safe positive-integer schema and shared own-key lookup reject malformed values/tags. ActionCard preserves raw blank as incomplete, not implicit whole force; root blank-force rendered cases remain disabled.                                                                                                                                                                                                            |
| I1-08     | Role mappings and declarative constraints own source/destination/force/speed/range. Domain composition validates prerequisites and rejects multiple moves/invalid slots, with arbitrary-role composed positive and schema failure controls. No Standard/Test ID/name/tier behavioral branches found.                                                                                                                     |
| I1-09     | Movement phase allocates all new departures before advancing or merging, derives deterministic child IDs and explicitly returns depleted source IDs. Root shared critical and real PostgreSQL full-force departure/reload demonstrate no phantom/stale source row.                                                                                                                                                       |
| I1-10     | Existing journeys advance once using persisted speed/capture; resource costs apply only to new locked submissions. Root shared critical tests prove2/5 ->3 ->1 ->arrival, continuation provenance and empty effect pool; worker fixtures prove actual reload/no-submission continuation. Prior exact root stored-speed/historical-source controls remain applicable because production bytes are unchanged.              |
| I1-11     | Occupancy is scoped by owner/instance, API checks null cancellation before writing, next-turn selections reset both fields to null, and arrival releases it. Root occupied card displays bound Northern20/Far Reach4ly without editable controls; independent same-definition free card stays usable.                                                                                                                    |
| I1-12     | Shared critical merge and hostile co-location controls prove existing friendly ID/name27 and ordinary enemy7/arrival20 separated with unchanged ownership. Explicit removedFleetIds reaches game-scoped worker deletion.                                                                                                                                                                                                 |
| I1-13     | Fresh PostgreSQL migration chain and worker mappers round-trip both JSON fields and clear transit tuple together. Root final resolver12 independently proves full failures plus input non-mutation for partial/duplicate journey corruption. Identical-input/RNG split and continuation controls preserve state/IDs/payment.                                                                                             |
| I1-14     | Root actual Testcontainers PostgreSQL gameplay3 covers source50 competing30/30 ->one stored30/free20, concurrent20+30 ->50 and coupled resource budgets. Start gates create overlapping requests; PGLite is not used as lock proof.                                                                                                                                                                                      |
| I1-15     | Root actual gameplay PostgreSQL3 executes separate real-worker Ready/deadline closure fixtures with exact actual game cutoff and coupled accepted-before/close-first outcomes. The new closure tests no longer compete with a future-clock manual processor. Existing concurrency cases remain included in tester's full5.                                                                                               |
| I1-16     | Shipped Standard data retains speeds0.1/1/5, ranges5/10/25 and costs3Influence/Fuel1/3/5; shared/router/unit/story controls consume these values. Root critical tests preserve20/5/0 movement ticks; ordinary movement does not fight. Fixed phase order remains.                                                                                                                                                        |
| I1-17     | Tester executed full configured12worker authenticated Playwright21/21 through actual exit and cleanup; root actual rendered partial20/remainder10, source/destination choices, occupied state, reservations and journey table checks passed independently.                                                                                                                                                               |

Current local quality evidence is tester-r5's full executed matrix with its final test-only edit accounted for, plus root independent53shared/3realPostgreSQL/12resolver and actual rendered evidence. SQL is exactly two nullable JSONB additions with no business defaults/backfill; existing docs and indexes accurately mark ordinary movement implemented and Assault/Colonize still planned. Source-only import search confirms the ten removed legacy validator paths have no callers. Current inventory includes untracked source/migration files and10deletions.

Before commit, root still requires reviewer-r3's full current-tree verdict/STOP, disposition of any actionables through the implementer, final report/format/diff checks, exact snapshot match and explicit intended staging with staged-diff inspection. No I1 acceptance or gameplay commit is claimed here.

## Reviewer-r3 dispositions and root reproduction (2026-10-11)

The full independent review ended with R3-01 and R3-02. Root accepts both against unchanged v1/all17. Root did not edit production/tests.

Root piped a read-only native TypeScript probe to pnpm exec node --input-type=module in the assigned packages/shared directory (normal-account escalation). Public resolveTurn, TestRuleset, trusted stubs, source50/selected20, distance1/speed0.1, FleetSchema JSON reload after each successful turn, no new submissions beyond departure. Exit0 reproduces the defect: turn9 distance0.10000000000000014; turn10 distance1.3877787807814457e-16 still in transit; turn11 stationary destination/tick1. Resources97I/99F throughout (100I/100F initially). This is successful reproduction of a contract violation, not passing acceptance.

An additional exit0 replay used authoritative evaluateActionSelection against each next collecting state. ACTION_ALREADY_IN_PROGRESS at collecting10 and11; ELIGIBLE at12. computeAvailableActions merely enumerates pool instances and cannot establish release; its always-offered flag in the initial probe is not occupancy proof.

R3-02 predicates were independently read: new corruption table and partial-parity public boundary still use Result.isFailure as the asserted result. A different failure class can pass despite violating initial authoritative validation/ADR018. Complete literal InvalidSubmissions issue assertions are required; retain unchanged-input assertions.

Existing implementer-r6 first owes a read-only minimal numeric proposal and then bounded approved corrections/regressions, followed by fresh independent tester/full reviewer and current-tree root acceptance. No production fix by root; no commit or next planner. The previous criterion mapping remains provisional and cannot approve the demonstrated decimal-speed bug.

### R6 proposal review before writes

Implementer initially proposed epsilon * advancesSinceDeparture * max(currentRemaining, capturedSpeed) after subtraction. Root did not approve it: a read-only arithmetic replay applying that exact clamp on EVERY advance still delayed valid declarative alternatives. Literal speed0.3/distance6/20advances leaves2.1094237467877974e-15 versus final1.3322676295501878e-15 envelope; speed0.1/distance10/100advances leaves1.8790524691780774e-14 versus2.220446049250313e-15. These are numeric proposal counterexamples, not claimed executed production tests. Earlier larger remaining distances contribute rounding that the proposed current-magnitude scale omits.

Root requested revised minimal accumulated-roundoff policy with appropriate earlier-magnitude accounting, finite overflow behavior, literal alternate-speed and genuine-extra-distance controls, while preserving authoritative stored distance/captured speed. No source/test writes authorized until revised proposal approval; v1/all17 unchanged. Existing implementer remains sole prospective writer.

### R6 corrected snapshot and independent production verification

Existing implementer STOP received with exactly phase/fleet-movement.test/resolveTurn.test changed from reviewed F2AB06; root manifest matches final86EB1C286BC302853C64925A9DDF8225C25634E79B193A18A22D33DCF64CFCB9 (99paths,89existing/10deleted). Code implements approved conservative earlier-operand envelope and finite fallback/cap; tests use +1e-10 real extra distance, literal departure20I20F ->17I19F, exact arrival/release and full invalid-submission oracles. Partial parity setup is affordable6I4F to isolate missing destination. Root read actual correction source/tests/report, no own production/test edits.

Root executed a read-only native TS production probe after STOP: pnpm exec node --input-type=module in assigned packages/shared, public TestRuleset and resolveTurn, JSON FleetSchema reload after each turn, source50/select20/1LY/shipped.1. Actual exit0/chunk87ccc9: turn9 moving(.10000000000000014), busy collecting10; turn10 stationary at destination/tick20, ELIGIBLE collecting11. Literal97I99F and source30/child20 assertions throughout. This closes the reproduced defect. It does not replace fresh full test/review gates or accept all17.

Fresh tester-r6 luna6/max/forknone commissioned against unchanged v1/all17/baseacde251 with whole-increment test review and full approved runtime/static/browser matrix. Production/docs read-only; sole test/support writer; no temporary source mutation. Prior verdict reports withheld until independent conclusions. Report tester-r6, STOP required before full fresh reviewer-r4 dispatch. No commit/next planner yet.

### Independent alternate-speed positive-boundary controls

Root additionally executed the public resolver with a fixed Test Improved definition changed declaratively to captured speed0.3/range10, full source50 departure, JSON FleetSchema reload every turn, no later submissions. Literal97I97F balances and source-row absence/strength50 asserted throughout. Exact6LY arrives20/tick20;6.0000000001LY remains moving at20 and arrives21/tick1;5.9999999999LY arrives20/tick20. Each instance eligible for a return draft after completion, using the actual surviving Fleet ID.

Initial read-only probe exited1 because root incorrectly expected only the busy diagnostic for a draft using the still-moving child and its recorded origin as destination. Actual authoritative issues also correctly included FLEET_NOT_STATIONARY and SAME_AS_ORIGIN. This was a verification-script oracle error, not a production defect. Corrected full expected diagnostic set; final actual exit0, observations confirm the positive-extra case stays busy at collecting21 and releases collecting22. No production/tests edited. Source snapshot remains pending final tester/reviewer accounting.

### Unknown-target dictionary-boundary check

Root inspected the authoritative entity and dependent-source lookups; they use own-record membership, so a prototype-shaped target ID is not a live entity. Read-only production verification then tested missing destination IDs constructor, toString and **proto**. Shared evaluation INELIGIBLE with the exact UNKNOWN_TARGET issue; public resolveTurn equals complete literal InvalidSubmissions payload and input state remains unchanged for all three cases. Actual pnpm native probe exit0/chunk35680a. No new finding or production/test edit; this concern is closed by actual code and execution.

## Root independent checks on tester-r6 final test snapshot

Tester-r6 reports full final shared21/134, backend integration6/97, unit2/6, real PostgreSQL concurrency2/5, combined Storybook/native15/54, frontend and Storybook builds, full authenticated default12-worker Playwright21/21 and root/package types/lint, exit0. Its own final report and STOP remain pending; no test gate or increment acceptance is inferred from progress messages.

Root exact progress manifest2F6044C7DB57170CE51F9C28F569A2DB88BFC05B727AC630A3FC15EE7878956F,99paths (89existing/10deleted), differs from implementer-r6 STOP86EB... only in three test files: backend TurnProcessor.integration.test.ts, shared validation/validateSubmittedActions.test.ts, shared resolveTurn.test.ts. No production/migration/frontend/docs byte changed. Root read the complete changed shared failure assertions and new public worker literal20/7 arrival test; tester confirms final shared134 and final B97 execute the corresponding final bytes.

Root independently executed pnpm --filter shared test src/action-submission/evaluateActionSelection.test.ts src/turn-resolution/fleet-movement.test.ts: actual exit0,2files/57tests,803ms, chunk82a2e2. Actual current allocation/range/candidate/parity, deterministic splitting, stored continuation, exact decimal-speed arrival/release, ordinary merge and hostile co-location controls pass.

Root independently executed pnpm --filter backend exec vitest run --project concurrency src/api/gameplay/gameplay.concurrency.test.ts --silent: actual exit0,1file/3tests,26.96s; session37448 followed through exit. Fresh Testcontainers database boot migrations, public overlapping strength/resource reservations, persisted full-source deletion and actual worker Ready/deadline closure controls pass. Expected rejected submissions log rollback errors; existing pg concurrent-client-query deprecation warning remains nonfatal. No PGlite lock proof or passing pre-exit output substituted for actual completion.

Fresh whole-increment reviewer-r4, final report/STOP and root current-diff acceptance/staging/commit remain mandatory. No accepted gameplay commit or next planner yet.

## Tester-r6 PASS/STOP and fresh full reviewer-r4

Root read the entire final tester-r6 report and all17 evidence rows. Its final report-only attribution clarification correctly identifies gameplay.concurrency.test.ts as actual real PostgreSQL migration/JSON/full-source-deletion proof, and TurnProcessor.integration.test.ts as PGlite worker continuation/arrival proof. Final shared134 and B97 checks account for all three semantic test-file edits. The report records actual local formatter-check history; future local formatting must use WRITE, per AGENTS. Tester explicitly stopped all writes.

Final apps/packages/docs snapshot2F6044C7DB57170CE51F9C28F569A2DB88BFC05B727AC630A3FC15EE7878956F,99paths (89existing/10deleted), matches root. Full current matrix passes: shared21/134; backend U2/6,B6/97,C2/5(realPostgreSQL); Storybook/native15/54; frontend/Storybook builds; full authenticated default12-worker Playwright21/21; root/shared/backend/frontend typechecks; lint; formatter-write and diff checks. Production/docs/migration/frontend bytes unchanged since implementer-r6; root source/test fixes none.

Root separately verified browser cleanup through actual listening-port inventory: assigned API10130 and frontend10131 both have no listeners, exit0/chunk9ac890. Ports were read with Node's built-in dotenv parser without printing or changing any environment values. An initial literal-unquoted-line regex failed to read the quoted port definitions; this was root's read-script limitation, corrected with the actual parser, not an environment or production defect. Intentional same-worktree Storybook preview remains available on6006.

Fresh /root/increment01_reviewer_r4 commissioned explicitly gpt-6.1-sol/high/fork_turns none with persona, approved unchanged packet/all17, authoritative requirements, absolute worktree/branch/base, repository readings and full tracked/untracked scope. No previous persuasive verdicts or finding narratives supplied. Production/tests/docs read-only; only reports/increment-01-reviewer-r4.md writable; no subagents or delivery actions. All code/test writers stopped. Entire-increment findings/verdict and STOP remain pending, then root final current-diff acceptance/staging/commit. No accepted I1SHA, next planner or gameplay push.

## Final I1 orchestrator acceptance (2026-10-11)

ACCEPTED: unchanged approved v1, every I1-01 through I1-17. Root read the complete final tester-r6 report/evidence matrix, reviewer-r4 substantive entire-increment assessment and limitations, exact inventory/STOP. Both roles bind the same99-path snapshot2F6044C7DB57170CE51F9C28F569A2DB88BFC05B727AC630A3FC15EE7878956F (89existing/10deleted), independently matched by root after review conclusions. Reviewer explicitly reports no actionable findings for the FULL tracked/untracked increment versus acde251d2fb2164eb7cd881fb55fc5f08e52d817 and stopped all writes. No unresolved demonstrated finding, acceptance waiver, or blocking design/ADR/environment issue remains in I1.

Root's earlier complete17-row acceptance preparation is now accepted with its later corrections accounted for: R3-01 Standard decimal-speed arrival/release fixed and independently verified through public resolver/JSON reload on turn10/tick20, plus exact alternate0.3/6 and positive-extra-distance controls; R3-02 full authoritative failure oracles implemented and executed; fresh tester's three final test-only edits include whole missing-owner/unknown-player failures and public worker enemy20/7/unchanged planet ownership/separate arrival/release. All prior O/R1/R2 actionables were corrected in implementation and the fresh complete review found none remaining. No root production/test fixes were made.

Current full quality gate: shared21/134; backend unit2/6, integration6/97, real PostgreSQL concurrency2/5; combined Storybook/native15/54; frontend/Storybook builds; full authenticated default12-worker Playwright21/21 through actual exit and server cleanup; root/shared/backend/frontend typechecks; lint; formatter-write and diff checks, all successful. Reviewer independently reran full shared/U/B/C/Storybook, focused authenticated E2E7, root/package types/lint, fresh PGlite migration and structural snapshot equality. Its stated lack of repeated builds/fullE2E/manualvisual/sourceformat/CI is accounted for by current tester/root evidence; CI belongs to final PR delivery and remains pending for the whole goal, not falsely claimed from preparation SHA.

Root independently executed57critical shared tests and3realPostgreSQL gameplay tests at current production snapshot, plus actual public native decimal/alternate/corruption/unknown-target controls. Root actually inspected five rendered UI states and preserved screenshots; frontend/story/DTO bytes remained identical through later shared-only correction and test-only additions. Actual port inventory confirms API10130/frontend10131 have no listeners after completed browser checks. Migration SQL/snapshot adds exactly nullable JSONB selected_inputs/movement with no business defaults; fresh PostgreSQL chain passes. Existing affected Systems/indexes/glossary/architecture accurately describe ordinary movement while later Assault/Colonize remain pending. Deleted validators have no remaining source callers.

Root final intended inventory includes all changed tracked AND untracked source/tests/docs, the approved packet, reports and intended rendered/raw-failure evidence; generated videos/env/auth files excluded. Index was empty at preparation. Next operations: recheck exact snapshot, explicitly stage intended paths, inspect staged diff/whitelist, commit with normal repository hook, account for any hook changes, record actual SHA, then commission fresh planner02 from that SHA. Acceptance precedes commit; no commit exists by this record alone. Overall agreed Assault/colonization/integration/PR/latest-head-CI task remains unfinished and must continue.

## Staged evidence whitespace correction

The first explicit staging/whitelist operation succeeded, but git diff --cached --check exited1 on archived orchestration artifacts only: Markdown hard-break trailing spaces in tester-r1/r2 reports, an extra EOF blank line in reports/.gitignore, and trailing spaces on blank source-code excerpt lines in the two captured browser error-context.txt files. No source/test/docs manifest path failed and no gameplay change is involved. Root normalized trailing whitespace in those records and the ignore file, preserving each untouched diagnostic capture locally as error-context.original.txt and ignoring only those duplicate originals. Tracked diagnostic text changes are whitespace-only; messages, line numbers, failure statements and prior role conclusions remain intact. Old generated recordings remain ignored. This is orchestration evidence formatting, not a production/test repair or acceptance waiver. Recheck exact accepted source manifest and all staged checks before commit.

## Accepted I1 commit and next increment base

Actual commit06954d1a35759a5fa5bd4271f0585ba3ef71c6e4: fleet-operations: implement shared eligibility and ordinary fleet movement. git commit actual exit0/chunk760781; normal lint-staged hook completed oxlint--fix and formatter-write, with no reviewed source bytes changed. Final post-hook apps/packages/docs manifest remains2F6044C7DB57170CE51F9C28F569A2DB88BFC05B727AC630A3FC15EE7878956F,99paths. Explicit staged whitelist134paths (99source/test/docs plus35experiment artifacts) matched; staged diff check and unstaged intended-file check passed. 12renderedPNG artifacts committed; generatedWEBM and duplicate untouched original error captures ignored and preserved locally. Worktree was fully clean immediately after commit; normal hook did not require source/test repair or a waiver.

Root now records this actual SHA in durable orchestration files; those metadata-only post-commit edits are expected and preserved for the next increment. Fresh planner02 must verify HEAD/branch/root and use this accepted SHA as base, not preparation. Commission combines bounded composed arrival/provenance with normal Assault where that avoids an unconsumed pending-effect scaffold; fresh planner can justify a smaller coherent boundary without dropping acceptance. Initial-seed ledger numbers remain provisional until its concrete packet is approved. Colonization and full integration/delivery follow. No gameplay push or latest-head CI acceptance yet; existing PR595 remains draft/preparation head. No final completion is claimed.
