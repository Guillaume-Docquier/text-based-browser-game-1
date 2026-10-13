# Increment 01: shared eligibility and allocations

## Identity

- ID/title: 01 — Shared action eligibility, cumulative allocations, playable partial departure.
- Root: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`.
- Branch: `codex/fleet-operations-sol`.
- Base: `aa9272ec2b9ac756aa5d606bca900875ff9f58ed` (experiment preparation; gameplay source `e9408c64620fc988dc3b1fd39827afabcb7d40f5`). Orchestrator planning-ledger edits are outside gameplay delta.
- Approved version: **v1 approved by orchestrator on 2026-10-10**. Implementation authorized against this unchanged acceptance contract.
- Goal: shared draft/complete eligibility for source-dependent targets, numeric fleet strength, resource/strength reservations and replacement, integrated at frontend/API/resolution; chosen partial strength actually departs and continues.
- Non-goals: Assault/Colonize/ownership change, coordinated chronological arrival/provenance, pending arrival effects, cloaking/population, versioning/scripting, new GDDR/System, outcome-history UI, rebalancing existing speed/cost.
- Personas/model/effort: planner `fleet-planner.md` gpt-6.1-sol/high; implementer `fleet-implementer.md` gpt-6.1-sol/medium; tester `fleet-tester.md` gpt-6.1-sol/medium; reviewer `fleet-reviewer.md` gpt-6.1-sol/high. Fresh contexts; no worker subagents.
- Authority: [requirements.md](../requirements.md), which supersedes old colonization design. No colonization code here.
- Allowed implementation writes: affected shared domain/submission/resolution and colocated tests/stubs; backend gameplay/turn processing/existing ruleset and DB adapters/generated migration; frontend play/contracts/hooks/stories/POM/specs; required test harness support; existing docs listed below; assigned report. No env-value/main-checkout edits, unrelated refactors, worker commits/push/PR. Planner writes only this file.

### Criteria moved from increment 2

Stationary-source validation would strand journeys because current movement needs resubmission. The orchestrator acknowledged bringing basic automatic continuation, persisted speed/action binding, in-progress presentation and cancel/edit/reuse rejection, reload support, partial departures, zero cleanup, friendly arrival merging and next-turn release into increment 1. This covers original increment-2 2/2/1 progress, splitting, reload/binding, locks/reuse, basic merge/views and focused browser flow criteria. Increment 2 retains chronological 20-tick coordination, separate arrival provenance and pending arrival-effect composition/redirection through merges, and still verifies full lifecycle. No original criterion is dropped.

## Evidence and proposed change

### Current implementation

Paths are relative to assigned root.

- Shared `domain/ruleset/action-definitions/ActionDefinition.ts` has targets/resource-loss costs/effects, no input definitions; schema checks effect target mappings only. `effect-definitions/FleetMoveEffectDefinition.ts` has fleet/planet role mappings and positive speed only. `target-definitions/TargetConstraint.ts` admits ownership alone.
- Shared `domain/turns/actions/Action.ts` uses null/non-null `selectedTargets` to distinguish available/submitted; stable pool IDs distinguish instances of one definition. No numeric payload.
- Shared `action-submission/validation/validateSubmittedActions.ts` runs definition/targets/resource costs and discards prerequisite failures. `validateTarget.ts` gets type/owner only. `validateCosts.ts` clones state and subtracts resources in enumeration order; `getUncommittedResources.ts` separately subtracts the same costs.
- Backend `api/gameplay/updateActionSubmission.useCase.ts` validates only candidate, against total resources. It fetches candidate selected entities only: no prior allocations or source origin planet. `gameplay.repository.ts#getActionSubmissionsForUpdate` correctly locks collecting Turn `FOR NO KEY UPDATE` before deadline/readiness/state reads. Keep paired branded read/write, same transaction. `getPlayerView` uses repeatable-read and loads all game planets/fleets/player actions.
- `getPlayerView.useCase.ts#toActionDtos` evaluates resources against empty entities and marks submitted actions affordable. Frontend `features/play/components/TargetPicker.tsx#getTargetOptions` discards IDs/strength/positions/transit. `ActionCard.tsx` calculates independent slot options, autofills singleton selections and automatically sends incomplete target edits.
- Shared `turn-resolution/effects/implementations/FleetMoveEffect.ts` moves whole source, calculates isolated arrival tick and immediately lands/merges. `resolveFleetMovementPhase.ts` loops submitted effects only. Two same-source moves may operate on already mutated source.
- `Fleet.ts`/`fleetsTable` persist destination/distance but no speed/binding; `ResolutionFleet.ts` has transient tick. `computeAvailableActions.ts` reoffers every pool entry. `TurnProcessor.ts#processTurn` removes zero fleets and computes new actions without fleet state; `turns.repository.ts` round-trips old fields/targets only. Worker does not depend on API.
- Standard and independent Test `action-definitions/move-fleet.ts`: Influence3, Fuel1/3/5, speed0.1/1/5. Some tests assert Standard IDs while using Test; touched tests must use independent Test definitions.
- `tests/ConcurrencyTestApiServer.ts` provides real PostgreSQL18.4 and forked production API; only lobby concurrency tests exist. PGlite integration cannot prove locking.

### Readings and architecture

Consulted root/scoped shared/backend/frontend/docs AGENTS; coding standards/glossary; installed `packages/shared/node_modules/@guillaume-docquier/tools-ts/README.md`; architecture/GDDR/System indexes; ADR007/008/011/013/015/016/017/018/022/023/024/025/026/027/028/029/030/031; architecture turn-resolution/turn-processing; GDDR009; Systems001/003/008/010/011/012/014/015. Backend router-only scoped rule overrides ADR016 for API tests. Preserve native erasable TS, string entity IDs, DI, Results, direct shared exports and named type-only API contracts. Resolution guide prohibits new throwing assertions in engine; typed failures instead. No new adapter/service needed: extend existing repositories and local projections.

### Proposed schemas, effects, constraints and inputs

1. Add branded `InputTag` beside TargetTag, `ActionDefinition.inputs: Readonly<Record<InputTag, InputDefinition>>`. Only needed variant: `{ type: "FLEET_STRENGTH", fleetTargetTag: TargetTag }`. This is a required positive whole-number numeric selection/reservation; target IDs stay in SelectedTargets. Mechanics never compare tags to literal `fleet`/`strength`.
2. Add SelectedInputs record of tags to branded finite safe positive integer strength; constrain before branding. Use tools-ts safeTypedParse for expected invalid construction; typedParse for trusted construction outside runtime-failure paths. Draft type explicitly permits missing/raw numeric choices rather than Partial<SubmittedAction>.
3. Available actions: both selections null. Submitted actions: both records (empty for no-input/no-target actions). Transport union accepts both-null cancellation or both-record update; mixed null invalid. Existing outer submittedActionTargets request name may remain; payload gains selectedInputs. No default to whole-fleet strength. Explicitly update empty inputs/selections in other content/stubs.
4. FLEET_MOVE gains effect input mapping `inputs.strength.actionInputTag`; mapped FLEET_STRENGTH must reference same fleet slot as effect fleet role. parameters.speed remains sole speed value.
5. Add constraints STATIONARY_FLEET on FLEET; WITHIN_FLEET_RANGE `{ fleetTargetTag, maximumDistance }` on PLANET, referencing source origin and finite positive distance. Keep ownership constraint. Range also rejects origin planet ID; distinct coincident planets remain legal zero-distance targets. Shared getPlanetDistance computes existing Math.hypot(x/y deltas) for both constraint and execution; no rounded display/coordinate-string validation.
6. Action/ruleset schema rejects missing/wrong-type dependent references, bad input/effect mappings, unused numeric inputs, nonfinite/nonpositive parameters, unsupported constraint types and source mismatch. Supported movement composition is at most one FLEET_MOVE per action; require owned stationary fleet constraints and destination range referring to its fleet role. Reject ambiguous/multiple moves before persistence/load. Existing other effects may compose with one Move; future Move+Assault+Colonize remains possible. Document bounded vocabulary, no speculative expression engine.

### Common eligibility and adapters

Add persistence-agnostic ActionEligibilityState in shared action-submission: game/turn identity, keyed typed players/planets/fleets, total resources, current submissions and active journeys. Adapters scope all entities to this game; ruleset supplies definitions/pool. Frontend/API need not construct mutable TurnState merely to choose targets.

- evaluateActionSelection({ state, ruleset, action: { id, playerId, actionDefinitionId }, selection, mode: draft|complete }): structured issues with target/input tag paths, missing/dependency status, commitments and complete eligibility. Absent draft value is incomplete; present bad value invalid. Complete missing data is illegal.
- evaluateTargetSelection({ same context, targetTag, targetId, selection }): candidate substituted into same draft evaluation; eligible/ineligible/dependency-pending for that slot. Destination without source remains pending/disabled. Wrong type/unknown entity invalid regardless of other missing fields. Candidate eligibility is scoped to that slot and its prerequisites: a source candidate is judged by its own ownership/stationary/available-strength requirements, not a stale selected destination or excessive old strength draft. Full-action eligibility still reports those dependent issues. Choosing another valid source must remain possible; then recompute or clear its dependent selections. Do not trap the source picker by filtering candidates on all unrelated draft errors.
- evaluateSubmittedActions({ state, ruleset, submittedActions }): complete selections, pool ID/definition binding, duplicate player/instance rejection, aggregate resources per player/strength per source, order-independent. Each input reserves once, not once per referencing effect.
- computeActionCommitments owns common accounting used above and uncommitted presentation. Existing validateSubmittedActions/validateTarget/validateTargets/validateCosts/getUncommittedResources either delegate or are removed with callers. No duplicate subtraction/decision path in apps or silently dropped prerequisite failures.

Shared replacement excludes matching `(playerId, actionId)` before candidate; cancellation removes only it. Draft counts other submitted orders plus candidate; sibling unsubmitted drafts reserve nothing. Same-turn Gain/Build cannot finance departure because their phases occur later.

Frontend adds one player-view projection retaining total resources, all IDs/planet x/y/source origins/strength/transit/journeys and player submissions. TargetPicker enumerates entities by type and calls shared candidate evaluation. ActionCard uses complete evolving draft and identity, numeric input/shared reasons; submit enabled only if complete eligible. Source changes recompute dependencies, clear or visibly invalidate old destination without choosing another silently. Singleton autofill enters evaluated draft. Existing submissions edit locally then explicit valid update; no invalid keystroke submissions. Cancel remains usable during invalid edit; stale drafts reset when turn/action/server selections change. Successful mutation refreshes authoritative view/sibling commitments.

API keeps turn lock, loads full proposed set's context including source origins/active journeys and total resources. All game-scoped planets/fleets is acceptable at current scale. Shared replacement/set evaluates under same transaction; occupied cancellation checked first. Write candidate only; failed edit retains old selections/reservations.

Player view uses common commitments for resource/source uncommitted amounts. Replace misleading resource-only canAfford with named resource affordability and availability; empty movement draft cannot be complete eligible. DTO has AVAILABLE/SUBMITTED/IN_PROGRESS plus occupied bound fleet/destination and selected inputs. Server supplies state, not target combinations. Named contracts derived in `api/types.ts`, frontend type-only imports.

Resolution projects full locked state and runs same complete-set evaluation before payment/mutation, including pool-instance binding/occupancy. Invalid/corrupt submission returns InvalidSubmissions. Departure reuses current-source predicates; materialize all valid allocations before movement/merge. Do not count already applied reservations twice.

### Concrete parameters

| Move        | Influence | Fuel | Speed LY/turn | Maximum distance LY |
| ----------- | --------: | ---: | ------------: | ------------------: |
| Standard    |         3 |    1 |           0.1 |                   5 |
| Improved    |         3 |    3 |             1 |                   5 |
| Exceptional |         3 |    5 |             5 |                  25 |

Preserve existing definition/pool IDs, names/tiers/starting resources. Ranges5/5/25 are explicit technical defaults, solely destination constraint data; UI derives them. Standard backend content and independent shared Test content updated separately. Add second Test pool entry for one existing Move definition for instance tests while preserving original IDs; update affected expectations, no second Standard instance. Renamed custom shared fixtures use speed2/range5. No unsupported Assault/Colonize placeholder/input.

### Continuation/payment/locking/arrival/merge behavior

- Bounded FleetMovement value on moving fleet, retaining destinationPlanetId/distanceToEnd for maps. Persist movement `{ type: "FLEET_MOVE", initiatingTurn, submittedAction, speed }`. Original submission records source/destination/chosen strength/owner/instance; origin/destination/remaining fields persist route. Parse all-present transit or all-absent stationary state; inconsistent state is typed load/resolution failure. No arbitrary executable plan or unused future pending-effects field.
- Depart allocations in canonical `(playerId, actionId)` order before advancing arrivals. New child journey for every order; original source ID/name stays on stationary remainder. Child string IDs use existing uuid-v5 pattern with movement namespace and game/player/turn/action/source identity. Extract/reuse seeded name generation if needed, canonical generation order. Full allocation removes zero source from active lookup before Build/merge; no phantom or zero reinforcement.
- Costs paid once in Pay Costs from current submissions. Relocation preserves selected strength; source50 and orders20/15 yield stationary15 and journeys20/15; 20/30 yields no origin source. Never deduct chosen strength twice.
- Movement phase advances existing journeys and new departures exactly once by min(saved speed, remaining distance). Capture preexisting journey set or separate departure/advance work; child cannot advance twice. Continuation creates no new submission/payment/reservation/stationary validation; saved speed unaffected by mutable seeded content.
- Current movement effects complete with departure/progress outcomes; unfinished journey is persisted state, never an unresolved effect violating empty-pool invariant. Do not add outcome-history machinery solely for continuation.
- Occupancy key `(playerId, initiating actionId)`, not definition. computeAvailableActions omits occupied instances using surviving journeys; game-start passes none, TurnProcessor passes resolved fleets. View presents in-progress actions from journey despite no reusable current-turn row. Locked read checks journeys before rejecting missing row, so occupied edit/cancel/redirect/reuse rejects clearly including forged old/new-turn payload. Another same-definition instance may use stationary remainder.
- Arrival into positive same-owner stationed fleet preserves its ID/name and adds incoming strength; otherwise keep child ID. Ordinary simultaneous arrivals use canonical advance order for stable survivor here; increment2 supplies chronology before arrival effects. Ignore zero fleets in merge/Build lookups. Clear movement on terminal/merged fleets; zero cleanup releases all completed instance bindings. Ordinary Move into enemy fleet causes no combat or ownership change.
- Expected later execution destruction/terminal disappearance completes/prevents journey and releases action. Corrupt references/malformed initial submission fail, not Prevented. No shipped destruction mechanic yet; cover terminal cleanup at shared phase/state seam. Illegal aggregate20+31 is InvalidSubmissions, never Prevented.
- Release after arrival/terminal cleanup for next collecting turn. Paid costs stay spent, original selection immutable; no transit cancel/redirect/refund. Increment2 adds pending arrival effects, separate arrival provenance and merge-safe effect identity; transient arrivedAtTick alone does not satisfy that future contract.

### Data persistence, migration and isolated database

- actionsTable adds nullable JSONB selected_inputs: explicit null on available inserts, validated record (possibly empty) on submission, both selections null on cancellation. Update game-start/next-turn/model/stub/load/save mappings.
- fleetsTable adds nullable JSONB movement using validated shared journey type. GameplayRepository and TurnsRepository round-trip symmetrically, upsert every field and explicitly clear null on arrival. App supplies business defaults. Do not add SQL business range checks/new strength cap. Existing positive-strength check remains; delete zero before upsert.
- Generate named Drizzle migration `pnpm --filter backend db:generate --name fleet_action_inputs_and_movement`; include SQL/metadata. Boot migration unchanged. No backfill/whole-strength compatibility default: isolated DB may reset/migrate/seed per project instructions; old-schema game saves intentionally not retained.
- Setup completed: cosmic-empires-worktree-45; DB10135/backend10136/frontend10137. Only assigned checkout's services; no environment-value edit/main DB reset. If stopped, `pnpm db:up` here. Report environment limitations separately.

### Implementation steps and documents

1. Shared input/mapping/constraint/distance schemas and stubs; integrity tests; explicit empty input definitions/selections in no-input content.
2. Shared draft/complete/candidate/commitment evaluation and replacement/cancellation; migrate old entrypoints to delegate. Independent literal-oracle tests.
3. Deterministic partial departure, snapshotted automatic continuation, zero cleanup/basic merge/release; fixed phase order and empty pool.
4. DB migration/API/worker round-trip, locked complete-set update, availability/player view/named contracts; existing repositories, no API dependency in worker.
5. Apply storybook-agent-workflow before frontend work. Reuse ActionCard/TargetPicker/SearchSelect/existing number input; full eligibility/dependencies, local valid edits/cancel, progress. Rules text derives speed/range/input roles. Fleet/map views show persisted strengths/distance.
6. Shared scenarios, router integration, real PostgreSQL concurrency, Storybook/E2E. Set up fleets/resources via API actions/turns, no SQL state setup/test repository. Adjust tests assuming whole fleet/unrestricted destination while preserving their product assertions.
7. Existing Systems001/003/010/012/015 current behavior/status/index, System014 commitment text as needed; glossary inputs/allocations/journey; architecture turn-resolution validation/automatic flow and turn-processing mappings. Keep chronological/combat/colonization/cloaking planned. No new ADR/GDDR/System. System008 colonization update belongs to increment4.

### Risks, defaults and unresolved blockers

No unresolved game-design/accepted-ADR blocker. Lifecycle expansion acknowledged by orchestrator; packet v1 approved. Legacy engine Assert calls conflict with resolution guide: add no new throwing expected-error path; fix affected paths where needed without broad refactor. Retain existing PostgreSQL integer storage/native TS constraints without inventing game strength cap.

Likely defects are omitted source origins, double-counted edits, definition-level occupancy, child advancing twice, continuation repayment, uncleared JSON and stale UI drafts/autofill. Acceptance covers these. Chronology remains a later Assault/Colonize prerequisite. Any subdivision needs amended approved packet and player-correct shared-validation parts; never expose ignored inputs or disable transit selection without continuation.

## Acceptance contract

Each Given/When/Then has literal oracle. Shared tests exercise exported behavior, not private helpers. APIs are observed through routers; real TurnProcessor/repositories may process turns. Game state setup never bypasses API.

Command keys:

- **S:** `pnpm --filter shared test`; focused file during development, full suite at gate.
- **I:** `pnpm --filter backend test --project integration`, gameplay router/TurnProcessor.
- **C:** `pnpm --filter backend test --project concurrency`, real PostgreSQL, require_escalated on Windows per backend instructions.
- **B:** `pnpm --filter frontend storybook:test`; load storybook-agent-workflow first.
- **E:** `pnpm --filter frontend e2e playwright/specs/actions.spec.ts playwright/specs/fleets.spec.ts`; load run-e2e-tests and read playwright/AGENTS first, follow completion and cleanup. Full applicable E2E also gate.

### Shared eligibility

- **A1-01 — 50 aggregate.** Given owned stationary source50, two distinct instances (including different Move definitions) and enough resources, when20+30, then UI/API/resolution accept and available strength0. Replace30 with31: reject aggregate51 versus50, shortfall1, independent of enumeration. Failed API edit keeps20/30. Corrupt locked20/31 fails before payment/movement; preserved pre-resolution source50. S/I/B parity fixture.
- **A1-02 — replacement/cancellation.** Given X20/Y30/source50, replace X15: committed45/available5, not65 committed. Replace X21 fails keeping20. Cancel X: Y30/available20; cancel Y releases30. X's cost3 Influence/1 Fuel counted once on edit and released exactly on cancel. Failed resource or strength replacement preserves original. S/I/B.
- **A1-03 — resource aggregate.** Given Influence6/Fuel2 and two Standard Moves costing3/1 each, both commit with totals6/2/uncommitted0/0 until resolution. Third legal1-strength Standard instance rejects for missing3 Influence/1 Fuel. With total5/2, second rejects Influence shortfall1 although strength affordable. Same-turn Gain does not cover shortage. Accepted pair resolves leaving0/0 and costs paid once. S/I.
- **A1-04 — strength malformed/bounds.** Given valid source50/destination, absent/0/-1/1.5/51/nonfinite/unsafe integer/null/numeric string strength rejects complete submission without persistence/payment. Draft absence incomplete; present0/-1/1.5 invalid.1 and50 succeed with no other commitments. Unexpected input tag/missing or unexpected target tag rejects; target string "20" cannot be numeric input. Transport rejects structural nonnumbers; shared evaluator also handles raw numeric draft validation. S/I/B.
- **A1-05 — invalid source parity.** Given other valid choices, enemy/nonexistent/wrong-game/moving/exhausted source rejected by UI/API/resolution. Legacy zero-strength active fixture rejected as exhausted. Missing source origin is invalid authoritative context, never eligible range. Foreign-game fleet/planet IDs reject even if external owner matches. S/I/B.
- **A1-06 — source-dependent range.** Given S=(0,0), T=(10,0), range5, P=(3,4), Q=(3,4.000001), R=(10,3), choose S: P exactly5 succeeds, Q just outside fails, R fails. Change to T: T remains selectable while stale P or an excessive previous strength draft is invalid; choosing T then recomputes/clears P, R succeeds/P fails, and stale destination cannot submit. Destination with absent source pending/incomplete. Source planet ID fails; distinct planet at(0,0) succeeds/immediate arrival. Rounded display cannot admit Q. S/I for available scoped entities; B exact synthetic view.
- **A1-07 — data-driven/integrity.** Renamed IDs/names/tiers/tags with speed2/range5 behave by mappings. Only range4 makes P invalid; only speed1 changes progress, not range. Domain construction/load rejects missing/wrong source/input references, unsupported constraint target type, nonfinite/zero/negative speed/range, unused numeric input, missing owned/stationary/range movement constraints and two Moves in one action. No engine ID/name/tier/literal-tag branch. S, backend unit ruleset tests, B.
- **A1-08 — instances/current-state.** Two Test pool entries of one definition both usable once and share source accounting; duplicate same-instance rejects. Busy X does not occupy Y. Initially valid draft/locked order on source20 becomes invalid on fresh state19, owner change, transit, or resources below cost at every boundary; submitted canAfford/initial-validity flags cannot override snapshot. S/I/B.
- **A1-09 — real adapters parity.** Same explicit state/selection/reservations through frontend projection, API decision and resolver prevalidation for A1-01/04/05/06/08 yield equal substantive decisions/shortfalls/paths. Exercise real projections or observable router/resolver results, not three direct evaluator calls renamed as adapters. Include total-versus-uncommitted resources, origins and multiple prior orders. S/I/B; reviewer inspects actual delegation.

### Playable runtime/persistence

- **A1-10 — split honored.** Source50;20 and15 to different destinations, each distance5/speed2. After departure original ID remains stationary15, distinct deterministic children20/15 with distance3 each, total50. Reversed enumeration gives same IDs/names/state under same RNG; neither child moves twice. S/I (API can build50 via repeated Test Build actions).
- **A1-11 — full allocation/merge.** Source50 with20+30 leaves no zero origin row/marker. Child20 arrives into own stationed7: stationed ID/name survives27, child gone, action bindings released. Into enemy7: own20 remains separate/enemy7 unchanged, no combat/ownership change. Two ordinary friendly arrivals into empty planet preserve total and stable survivor under reordered input. S/I.
- **A1-12 — 2/2/1 continuation/reload.** Source50 selecting20, speed2/distance5/cost3 Influence1 Fuel: first turn source30/journey distance3; reload and no new Move on following turns gives distance1 then stationary destination20. Total cost3/1 across all three turns. Saved speed2 remains after seeded definition becomes1. Source/destination/chosen strength/initiating turn/instance persist each reload. Replay same pre-turn state/RNG produces identical state/no double pay/split. S/I.
- **A1-13 — occupied lock/release.** After X departure next-turn view IN_PROGRESS with actual bound fleet/destination, no reusable row/cancel control. API submit/edit/redirect/reuse/null-cancel X rejects, including old-turn payload. Y can use remainder30; moving child not source. Reload lock persists. Arrival/terminal cleanup makes X available next collecting turn, unrelated Y occupancy unchanged. Shared zero-terminal fixture tests release; malformed journey fails as corruption. S/I/B.
- **A1-14 — zero distance/pool/failure distinction.** Distinct coincident planets:20 arrives immediately without NaN/division by zero/stranding, instance reusable next turn. Distance5/speed2 unfinished journey still completes current effect/empty pool. Initially illegal submission is InvalidSubmissions; corrupt saved references typed failure; expected later destruction/prevention completes with explanatory Prevented outcome, retains paid costs and releases instance. No chronology claim here. S/I.

### Competition and UI

- **A1-15 — real PostgreSQL strength race.** API-created/observed source50 and enough resources, concurrent distinct-instance30/30 requests: exactly one success, one BAD_REQUEST, committed30/available20. Concurrent20/30 both succeed and commit50. Resolve accepted set: conserved total/no negative source/aggregate60 persistence. Use production transactions/repositories, concurrent Promise.all requests, no fixed-sleep oracle. C.
- **A1-16 — resource/edit/closure races.** Real-PG totals permitting one of two costly moves cannot accept both even when strength suffices. X20/Y30/source50: race X replacement25 with Y cancel; replace-first rejects/final X20, cancel-first succeeds/final X25; both Y cancelled, never overspent. Race submission against final readiness/closure and controlled-clock deadline promotion: only preclosure committed submission can enter locked set; after closure rejects. Preserve readiness/deadline rules. Extend test-only harness with actual production clock/worker deps as needed, no SQL fixture/test repository. C, retain lobby suite.
- **A1-17 — components.** Fixed view source50/X20 committed, Y30 can submit/Y31 reports shortage and cannot; cancelling X refreshes availability. Source change invalidates previous destination; absent strength incomplete. X edits exclude its own commitment; invalid draft never updates remote selection. In-progress X shows destination/fleet/disabled edits, Y independent. Text/input labels/available maxima derive from data/shared commitments. B independent of live auth/backend.
- **A1-18 — browser flow.** Fixed-seed two-player Test game: build10 normally, choose known in-range nonorigin planet, enter4, submit/end turn; Fleet/map shows remainder6/journey4. Reload/end turn without new Move: distance decreases, instance visibly busy through transit, reusable next turn after arrival; one payment. Encode literal expected planet/distance values after fixture inspection, never calculate oracle with production distance helper. Existing origin/destination links/actions flows adapted for explicit input/legal range. E.

### Quality gates and orchestrator spot checks

Run `pnpm exec oxfmt --write` on changed files; `git diff --check`; `pnpm lint`; root `pnpm typecheck`; shared/backend/frontend typechecks; full S; backend unit/integration/concurrency and type project where applicable; frontend build; Storybook build/test; applicable/full E2E. Storybook build uses exact reviewed `pnpm --filter frontend storybook:build` sandbox exception per scoped AGENTS. CI also runs backend/shared coverage; eventual latest-head CI must pass. pnpm only; no env-value changes to bypass problems. Repeat green checks only for changed inputs/fixes/concrete concern.

Orchestrator independently checks A1-01/02/06/12/15, migration reload, next-turn IN_PROGRESS, API occupied cancel/reuse, and actual frontend/API/resolution evaluator call sites. Tester maps all criteria to independent observable evidence and records gaps. Current setup green shared85/backend unit5/integration88 are baseline only, not acceptance evidence. This planning packet claims no gameplay checks.

## Handoff reports

Separate reports/ directory; fresh reviewers receive approved packet/full diff rather than prior conclusions. Orchestrator tracks references/dispositions in run-state.

- Implementer: changed files, criterion/test mapping, commands/exit codes, gaps, migration and moved-scope confirmation.
- Tester: test-only changes, covered criteria/literal oracles, demonstrated finding IDs/reproductions, commands/exit codes, current-diff test verdict/infrastructure limits.
- Reviewer: full increment diff from base including untracked files, actionable file/line/impact/criterion/ADR findings or explicit no-actionable-findings. Independently inspect model/composition/locks/player correctness.
- Orchestrator: approved version, report references, dispositions/exact spot evidence/final scope; record moved increment2 criteria without deletion.
- Commit: orchestrator only after gates; record SHA in run-state. Workers do not commit/open PR.

Findings have stable IDs; fixes identify them and revalidate approved contract. A passing older report does not approve new diff.
