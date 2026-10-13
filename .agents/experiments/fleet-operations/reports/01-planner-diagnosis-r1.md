# Increment 01 planner diagnosis r1

- Role: fleet-planner, gpt-6.1-sol/high; read-only diagnostic follow-up.
- Root: C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1.
- Branch/base: codex/fleet-operations-sol / aa9272ec2b9ac756aa5d606bca900875ff9f58ed.
- Approved v1 and authoritative requirements unchanged. No new approach or approval needed.
- Write scope used: this report only. No production/test edits, commits, environment changes or competing E2E servers.

## Finding PD-01: repeated full-state projection in the candidate filter

**Trigger:** an ActionCard enumerates a PLANET slot against a full player view, especially after successful Move submission/refetch. The original `apps/frontend/src/features/play/components/TargetPicker.tsx#getTargetOptions` called `toActionEligibilityState(playerView)` inside `.filter(candidate => evaluateTargetSelection(...))` (original approximately lines 69–75). Every candidate therefore flattened/indexed the same galaxy and rebuilt players/fleets/submissions before the shared evaluator examined it.

**Concrete complexity:** projection is O(P + F + A) for planets, fleets and current actions. A planet slot has P candidates, so projection work alone is O(P * (P + F + A)), including P squared planet visits/index insertions. It also reparses every submitted action P times. Build and Move cards each repeat a planet pass; ordinary query refresh creates fresh player-view identity and repeats these passes. The existing per-card `state` at ActionCard line 83 was already available but was not supplied to the candidate helper. No game rule requires a new projection per candidate.

**Impact:** synchronous rendering and allocations can delay committing a new card's SUBMITTED state after the API has already persisted it. Several cards and refreshes amplify the cost and garbage collection. This is a demonstrated unnecessary quadratic path and a plausible contributor to the five-second observable timeout; the Node measurements below do not by themselves establish all browser elapsed time or prove this was the sole cause.

**Simplest architecture-consistent fix:** compute the normalized state once per ActionCard render, pass it into getTargetOptions, and use that same state for every candidate and the final action evaluation. Alternatively getTargetOptions can project once before its filter, but reusing the already-created card state avoids an extra projection per slot. Keep evaluateTargetSelection as the decision owner, all total-resource/source-origin/current-submission fields intact, and no ad hoc frontend distance/ownership rules. Do not add sleeps or cache guesses. An eventual projection once per ActionSelector render is optional; the bounded per-card fix removes this defect without a new framework.

During this diagnosis the implementer, the sole production/test writer, changed the live helper to accept `state: ActionEligibilityState` and changed ActionCard line 88 to pass its existing state. This report confirms the change's causal basis; it is not a final acceptance verdict for that later diff.

## Independent read-only measurements

Executed native Node through pnpm from the frontend package, importing actual `toActionEligibilityState`, shared `evaluateTargetSelection`, independent TestRuleset and the production galaxy generator. No generated files or services. The comparison runs the same candidate loop/arguments, once with the prior per-candidate projection and once with one projection, and compares resulting eligible counts. Minimal deterministic public-view-shaped data was held constant; this is a diagnostic measurement rather than an automated test or browser timing oracle.

| Fixture                                       | Repeated projection | One projection | Eligible decisions equal |
| --------------------------------------------- | ------------------: | -------------: | ------------------------ |
| Synthetic 1,000 planets / one fleet           |               43 ms |           3 ms | yes, 500                 |
| Synthetic 3,000 planets / one fleet           |              423 ms |           5 ms | yes, 500                 |
| Actual seed 1234, 621 systems / 3,057 planets |              494 ms |           7 ms | yes, 225                 |

Both benchmark commands exited 0. Actual galaxy uses GalaxyCreationSettings and `Rng.create(mulberry32Prng(1234))`, with two named synthetic players, source10 at its generated home, Improved Move input4 and sufficient stockpiles. It reproduces candidate/projection cost without accessing a running test game. The approximately 70-fold difference in this measured pass supports the bounded normalization fix; do not encode these wall times as cross-machine pass/fail thresholds.

Read-only Babel/installed React Compiler transform of current ActionCard also exited 0. The generated submit closure captured current selections/evaluation and did not show stale memoization as a cause. This is limited evidence, not a blanket compiler guarantee.

## Persistence/projection trace and observable evidence

Source inspection:

- UpdateActionSubmissionUseCase validates the proposed replacement and calls GameplayRepository.updateActionSubmissions with both selectedTargets/selectedInputs under the same locked transaction.
- Repository update filters game/player/turn/action and writes both selections (current approximately lines 372–394); player-view read selects both (approximately lines 171–178).
- GetPlayerViewUseCase.toActionDtos sets SUBMITTED iff selectedTargets is non-null (approximately lines 121–134).
- ActionSelector uses `action.status === "SUBMITTED"` (approximately line 50), passing isSelected into ActionCard. The Selected cancellation button is rendered from that prop; merely valid local input never sets selected state.
- useUpdateActionSubmission already invalidates getPlayerView. BackendApiClient's global mutation-success override also invalidates ordinary queries; a local awaited invalidation can therefore be followed by another global refresh. That can amplify the expensive renders, but is not evidence that cache invalidation was absent. Avoid adding further invalidation paths.

The original test-results error-context file was unavailable when first inspected, apparently cleared by the active rerun. Prior `playwright-report/data/e7b41cff236bc653637054c47025e461902d039e.md` retained the five-second false aria-pressed failure, not the network payload/public state. I did not run another E2E process.

The orchestrator relayed the implementer's current diagnostic capture: correct Improved Move strength4 POST/HTTP200; an initial in-flight AVAILABLE view followed by authoritative SUBMITTED/isEligible true/selectedInputs4, source uncommitted6, Fuel3 of6. These network observations are attributed to that diagnostic run, not independently captured here. They narrow the problem to delayed client observation/rendering rather than an unpersisted Move in that run. An in-flight stale response alone is not a defect; the eventual authoritative view must be rendered.

## Verification still needed

1. Finish the implementer's focused E2E after projection reuse; keep the literal partial departure/continuation/occupancy assertions in A1-18.
2. Verify a refreshed public SUBMITTED action appears as the Selected card control before advancing the turn, then observe source6/journey4, saved continuation, in-progress action and next-turn release.
3. If unchanged card persists despite the optimized path, capture the exact request gameId/turn/actionId/targets/inputs, complete tRPC result, matching post-submit view row/turn and card text/count. SUBMITTED view with no rendered selected control isolates client state/rendering; AVAILABLE after valid POST would instead require persistence/request correlation. No arbitrary sleeps or weakened assertions.
4. Meaningful auto-retrying UI assertions may use a measured flow-appropriate timeout, but a timeout increase alone does not cure the quadratic work and must not become the sole disposition of PD-01.

No unresolved game-design/architecture contradiction. The approved shared evaluation approach remains sound; this is a projection-placement defect within its implementation. Final E2E disposition remains with implementer/orchestrator.

## Finding PD-02 / O1-03: accumulated subtraction postpones an exact arrival

**Original trigger and path:** `packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts` advanced each journey using `distanceMoved = min(savedSpeed, persistedRemaining)` then `remaining = persistedRemaining - distanceMoved`, and arrived only on `remaining === 0`. An ordinary distance1/speed0.1 journey without later submissions accumulated a positive residue. The orchestrator's independent `createFleetEligibilityScenario({ speed: 0.1 })`, destination `(1, 0)`, successive `resolveTurn` probe observed remaining0.10000000000000014 after resolution9 and remaining1.3877787807814457e-16 after resolution10; arrival incorrectly occurred at11. This delays both the fleet's arrival and the initiating instance's release. Positive decimal/fractional speed is already supported; this is implementation rounding, not a balance or design question.

**Smallest consistent disposition:** use the persisted initiating turn and saved speed to derive a canonical remainder from the immutable route each turn, rather than subtracting from yesterday's rounded remainder. Let `D = getPlanetDistance(originalOrigin, destination)` and `n = processingTurn - initiatingTurn`. The remainder before this resolution is `max(0, D - speed * n)`; after it is `max(0, D - speed * (n + 1))`. A new departure has n0, so it advances exactly once immediately. The next consecutive turn has n1. No epsilon, coordinate rounding, new schema, additional service or gameplay rule is necessary. This removes accumulated subtraction error; ordinary IEEE-number representation still applies to each direct calculation.

The implementer has added this calculation in the live shared movement phase and remains the sole production/test writer. The existing safe, nonnegative integer check on n correctly rejects future/invalid initiating turns. Keep schema validation of finite positive saved speed, finite nonnegative remaining distance, matching owner and all-present route fields, plus origin/destination existence validation. There is no additional necessary numerical guard for the reproduced valid routes. The pre-turn distance is capped by saved speed before forming the arrival fraction, keeping the existing tick calculation within0..20. Distinct coincident planets retain distance0/tick0.

**Sequential processing and persistence:** `TurnProcessor.processTurn` passes the actual queued processing turn to shared resolution and emits nextTurn = turn + 1. `TurnsRepository.saveProcessedTurn` saves distanceToEnd and movement together and creates that consecutive next turn. A saved post-resolution R remainder is `max(0, D - speed * (R - initiatingTurn + 1))`; on reload for R+1, the same expression is the next pre-turn remainder. JSON/PostgreSQL double round-trip therefore does not create a new rounding accumulation. Existing saved speed, original origin and destination are the journey clock; mutable ruleset speed and wall-clock schedule delay are irrelevant. Replaying the same pre-turn state/turn yields the same remainder, while the backend remains responsible for processing each logical turn once.

During transit, originPlanetId still names the original departure planet and coordinates are static. This assumption is supported by current gameplay and must remain explicit if later work introduces relocating planets or variable journey speed. Such future mechanics would need a new progress model; they are outside this fix.

Remaining distance is now a persisted projection for map/API observability, rather than a second independent movement clock. A syntactically corrupt route still fails current validation. Do not add an exact comparison against the old subtraction-derived remainder or silently use that value to override canonical progress: either would reintroduce this defect. If later corruption diagnostics check canonical consistency, compare against the correct pre-turn expression at the persistence boundary and distinguish an old roundoff discrepancy from missing/invalid journey fields. No extra persisted progress/version field is required for this increment.

**Tick and future chronology implications:** arrival tick uses `ceil(min(speed, canonicalPreTurnRemaining) / speed * 20)`, preserving the existing fractional-turn model. Distance1/speed0.1 reaches tick20 on resolution10. Distance1+Number.EPSILON leaves a genuine representable positive remainder at10 and arrives at tick1 on11; snapping it at10 would lose legitimate progress and chronology. Distance2.5/speed1 arrives at tick10 on3. This diagnosis does not claim coordinated arrival ordering/provenance, which remains increment2, or solve every floating-point boundary in future tied-tick ordering. It supplies one deterministic distance basis for that future chronology instead of a rounding-dependent extra turn.

## Independent PD-02 probe and acceptance implication

Ran a read-only native Node probe from packages/shared through pnpm, importing the actual scenario factory, resolveTurn and seeded RNG. It submits only at turn1, advances consecutive numbered turns without later orders, and JSON-serializes/reloads the fleet state between every resolution. No file, service, environment or test modification. Exit0:

| Literal route / saved speed           | Observed result after current fix                                         |
| ------------------------------------- | ------------------------------------------------------------------------- |
| distance1 / speed0.1                  | Transit through9 (remaining0.09999999999999998); stationary at10, tick20. |
| distance1 + Number.EPSILON / speed0.1 | Transit at10, remaining2.220446049250313e-16; stationary at11, tick1.     |
| distance1e-18 / speed1e-19            | Genuine tiny route preserved through9; stationary at10, tick20.           |
| distance2.5 / speed1                  | Remaining1.5 then0.5; stationary at3, tick10.                             |

These are explicit regression examples for approved A1-12 continuation/reload and A1-13 terminal release, supplementing the existing2/2/1 example. A1-14 zero-distance behavior must remain intact. The implemented automated regressions and normal shared/backend verification are still required; my JSON reload probe is independent arithmetic/domain evidence, not a substitute for the real PostgreSQL reload path. Check action occupancy remains through turn9 and is released for the collecting turn after resolution10, costs are paid only on departure, saved speed survives ruleset changes, and a fresh replay produces the same terminal state. No criterion or approved plan change is needed.
