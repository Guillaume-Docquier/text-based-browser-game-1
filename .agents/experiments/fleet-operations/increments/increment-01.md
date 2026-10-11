# Increment 01: shared eligibility, allocations, and executable ordinary movement

## Identity

- ID/title: I1 / Shared action eligibility and strength allocations.
- Root: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1`.
- Branch: `codex/fleet-operations-experiment`; base: `acde251d2fb2164eb7cd881fb55fc5f08e52d817` (preparation following e9408c6).
- Plan version: 1, approved by Fleet Operations Orchestrator on 2026-10-10. Acceptance contract is fixed for implementation and independent gates.
- Authority: [requirements](../requirements.md), superseding old colonization choices.
- Goal: one ruleset-driven eligibility path across partial frontend selection, complete API submission and locked resolution, with dependent targets, numeric force, aggregate resources/strength, replacement/cancellation and finite distance; execute every accepted input.
- Necessary added scope: split departures, persisted ordinary automatic movement, per-instance occupancy/API locks and visible journeys. Rejecting moving sources without continuation strands slow moves; orchestrator explicitly agreed to this boundary.
- Non-goals: Assault, Colonize, new attack/colonization cards, pending arrival-effect composition, hostile arrival competition, replay/history UI, cloaking, population, diplomacy, versioning or generic workflows. Increment 2 owns composed arrival intent/provenance and chronological competition, extending these journeys.
- Roles: fleet-implementer gpt-6-luna/max; fresh fleet-tester gpt-6-luna/max; fresh fleet-reviewer gpt-6.1-sol/high, following their `.agents/personas/` files. Planner gpt-6.1-sol/medium. No subagents. Orchestrator owns approval/commits and draft PR #595.
- Planner writes this file only. After approval implementer writes relevant shared domain/submission/resolution/testing, backend gameplay/worker/schema/migrations/Standard content, frontend action/fleet/map/contracts, associated tests and existing docs. Tester edits tests/support only; reviewer only its report. No env changes.

## Evidence and proposed change

### Current implementation and consulted references

Paths are worktree-relative.

- `packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.ts`: targets, resource-only costs, effects; schema checks effect target mappings. No inputs/dependent constraints. `effect-definitions/FleetMoveEffectDefinition.ts` has fleet/planet roles and positive speed only.
- `packages/shared/src/domain/turns/actions/Action.ts`: selectedTargets non-null means submitted; add numeric selections separately from entity IDs.
- `packages/shared/src/action-submission/validation/validateSubmittedActions.ts` independently invokes definition/target/cost validators and discards dependency failures. `targets/validateTarget.ts` sees type/owner only; `costs/validateCosts.ts` handles resources only. Reconcile `getUncommittedResources.ts` too.
- `apps/backend/src/api/gameplay/updateActionSubmission.useCase.ts` locks through GameplayRepository but validates only replacement and its selected entities, without retained submissions/origin planets. Repository already reads all current player actions under turn lock.
- `getPlayerView.useCase.ts` separately subtracts commitments, validates empty-target costs and assumes selected actions affordable. Replace this decision path.
- Frontend `features/play/components/{ActionCard,ActionSelector,TargetPicker}.tsx`: picker projects only type/owner; selector sends targets only. Inspect ActionCard drafts/autoselection; sole-option displays must enter actual draft.
- `packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.ts`: advances submitted whole fleets, Math.hypot distance, ceil(distanceMoved/speed*20) tick, immediate land/merge. Movement phase uses simplePhaseResolver. Fleet stores no speed/binding; ResolutionFleet has transient arrivedAtTick. computeAvailableActions reoffers stable pool IDs.
- Worker `apps/backend/src/turn-processing/{TurnProcessor.ts,turns.repository.ts}` must round-trip every new field without API imports. DB schema holds action selected_targets JSON and fleet movement columns.
- Standard `apps/backend/src/lib/rulesets/standard/action-definitions/move-fleet.ts` has speed 0.1/1/5, Influence 3, Fuel 1/3/5. Test Ruleset remains independently owned.
- API seam: gameplay.router.integration.test.ts. Real PostgreSQL harness: `apps/backend/src/tests/ConcurrencyTestApiServer.ts`, concurrency setup and `api/games/games.concurrency.test.ts`; add gameplay concurrency coverage using harness.

Consulted root/scoped AGENTS (shared/backend/frontend/docs), coding standards, glossary, installed tools-ts 10.1.2 README under `node_modules/.pnpm/@guillaume-docquier+tools-ts@10.1.2_zod@4.6.5/node_modules/@guillaume-docquier/tools-ts/README.md`; ADR index and accepted 007/008/011/013/015–019/020/022–031; architecture turn-resolution/turn-processing; GDDR index/009; Systems index/001/003/008/010/011/012/014/015.

Use Result/no-Assert engine boundary; existing FleetBuild Assert mismatch does not authorize unrelated refactoring. Reconcile turn-resolution.md's broad failure language with System015's completed Prevented outcomes when editing these existing docs. Requirements supersede old movement resubmission/colonization text; no new ADR/System/GDDR needed. Load storybook-agent-workflow before components and run-e2e-tests/playwright AGENTS before E2E. Native erasable TypeScript, direct shared imports, named @api-types type-only contracts, injected dependencies and tools-ts utilities remain mandatory.

### Domain, effects, constraints and concrete content

Names may follow local conventions; semantics/links must remain.

```ts
// InputTag string brand analogous to TargetTag.
type InputDefinition = { readonly type: "POSITIVE_INTEGER"; readonly label: string }
type SelectedInputs = Readonly<Record<InputTag, PositiveInteger>>
// PositiveIntegerSchema enforces finite safe integer > 0 before branding.
// ActionDefinition gains inputs: Readonly<Record<InputTag, InputDefinition>>.
// Non-input actions explicitly declare inputs: {}.
// SubmittedAction gains selectedInputs: SelectedInputs.
// AvailableAction has selectedInputs: null and selectedTargets: null.

// FLEET_MOVE retains fleet/planet target-role mappings and adds:
inputs: {
  strength: {
    actionInputTag: InputTag
    inputType: "POSITIVE_INTEGER"
  }
}
parameters: {
  speed: PositiveNumber
}

// Concrete constraints alongside ownership:
{
  type: "STATIONARY_FLEET"
}
{
  type: "WITHIN_FLEET_RANGE"
  sourceFleetTag: TargetTag
  maxDistance: PositiveNumber
}
{
  type: "DIFFERENT_FROM_FLEET_ORIGIN"
  sourceFleetTag: TargetTag
}
```

Source is a FLEET entity target; effect role determines meaning. Strength role maps arbitrary input tag; constraints reference arbitrary source slot. No runtime reliance on fleet/planet/strength slot spelling. Costs remain ResourceLoss definitions. Allocation is shared game behavior derived from mapped source/input, not new resource/general cost language. Later Colonize adds deferred requirement through the same evaluator mechanic seam.

Range lives once in WITHIN_FLEET_RANGE.maxDistance, not duplicated on effect. Shared distance predicate uses existing planar Math.hypot(destination.x-source.x,destination.y-source.y). Movement composition requires owned stationary source, destination range/no-op constraints referencing it. Schema checks prerequisites; runtime uses same predicates.

Schema/composition validation before persistence/load/start rejects missing/wrong-type target/input mappings, unknown variants, nonfinite/nonpositive speed/range; range/no-op on non-PLANET slot or missing/non-FLEET reference; missing matching owned/stationary/range/no-op prerequisites; non-POSITIVE_INTEGER mapped inputs and unused input declarations. Supported dependency is FLEET-to-PLANET, acyclic by construction; unsupported links reject. Reject more than one FLEET_MOVE in ONE definition even if sharing source/input, rather than double allocating. Multiple independent instances are legal. Other supported effects can compose with one move (e.g. gain); do not prohibit composition generally.

Use branded schemas for constrained numbers, safeTypedParse for handled failure, typedParse for trusted content/stubs outside engine. Explicitly update all Standard/Test content/stubs, without schema defaults masking missing fields.

| Standard ordinary Move | Influence | Fuel | Speed LY/turn | Inclusive range LY |
| ---------------------- | --------: | ---: | ------------: | -----------------: |
| Standard               |         3 |    1 |           0.1 |                  5 |
| Improved               |         3 |    3 |             1 |                 10 |
| Exceptional            |         3 |    5 |             5 |                 25 |

Speeds/costs preserve live values; ranges are planner defaults. Test moves retain costs/speeds and gain explicit ranges; add stable test opportunities only as needed, no content-ID runtime checks. Future normal Attack Move baseline: Influence 5/Fuel 1, speed 1/range 5. Future Colonize uses documented standard movement baseline, strength requirement 20 and no Colony cost; neither ships here.

### Unified eligibility API and consuming boundaries

Add cohesive public module under packages/shared/src/action-submission:

```ts
type ActionSelectionDraft = {
  readonly actionId: ActionId
  readonly selectedTargets: Readonly<Record<TargetTag, TargetId | undefined>>
  readonly selectedInputs: Readonly<Record<InputTag, number | undefined>>
}
type EligibilityState = {
  readonly gameId: GameId
  readonly turn: number
  readonly submittingPlayerId: PlayerId
  readonly resources: Readonly<Resources> // TOTAL, not already subtracted
  readonly planets: Readonly<Record<PlanetId, { id: PlanetId; ownerPlayerId: PlayerId | null; x: number; y: number }>>
  readonly fleets: Readonly<Record<FleetId, Fleet>>
  readonly actions: readonly Action[] // authorized instances/current submissions
}
type EligibilityIssue = {
  readonly code: EligibilityIssueCode // finite tagged codes
  readonly targetTag?: TargetTag
  readonly inputTag?: InputTag
  readonly message: string
}
type SelectionEvaluation = {
  readonly status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
  readonly issues: readonly EligibilityIssue[]
  readonly missingTargets: readonly TargetTag[]
  readonly missingInputs: readonly InputTag[]
  readonly resourceCommitments: Readonly<Resources>
  readonly strengthCommitments: Readonly<Record<FleetId, number>>
  readonly remainingStrength: Readonly<Record<FleetId, number>>
}
```

`evaluateActionSelection({state,ruleset,draft})` evaluates present/missing values. `evaluateTargetCandidate({state,ruleset,draft,targetTag,targetId})` substitutes candidate, delegates to identical constraints/mechanic evaluator, reports candidate-specific invalidity/dependency incompleteness; a valid source does not reject merely because downstream slots blank. `evaluateSubmittedActions({state,ruleset,submissions})` requires completeness and evaluates whole proposed set/aggregate once with stable per-action issues. Compatibility validateSubmittedActions translates this result; old wrappers must delegate, never duplicate.

Stages: authorized instance/definition and duplicate-instance checks; declared keys/types; entity existence; input parsing; ownership/stationary/positive strength; dependent constraints; mechanic force requirements; unified resource/strength ledger. Sum reservations across all definitions/instances per player. Same-turn gains/builds cannot finance departure. Equal normalized state gives equal decisions.

Partiality: blank declared slot/input is INCOMPLETE; present 0/-1/1.5/NaN/Infinity/unsafe integer or undeclared key is INELIGIBLE. Destination without source is dependency-incomplete/not selectable; sources remain browsable with blank strength/destination. Complete API input cannot accept INCOMPLETE. Missing origin is dependency/data issue, never infinite range. Exhausted source cannot supply positive allocation.

Replacement excludes candidate instance's old submission then adds candidate once. Cancellation removes only that submission. Identity is playerId/actionId in turn, not definition ID. Full-set evaluation aggregates once. Never subtract from already-uncommitted resources or trust client commitment totals.

Frontend projects total resources, coordinates, full fleets, selections/occupancy. ActionCard owns raw numeric text: blank maps undefined; parsed numeric values enter shared evaluation. Render definition-owned controls, available source strength and issues. Source change reevaluates destination immediately; clear invalid selection or visibly mark invalid and disable submit. Sole-option defaults must enter actual draft. Dependency rendering consumes evaluator output; no local domain predicates. Submit only ELIGIBLE complete draft. Backend canAfford is shared-derived presentation, never unconditional blocking of incomplete controls. Edits reevaluate selected actions.

API loads all retained submissions and referenced sources/destinations plus each fleet origin/movement under lock; bounded whole-game fleet/planet query is acceptable, avoiding per-slot SQL loops. Queries scope by game; wrong-game IDs normalize nonexistent. Opponent secret submissions are unnecessary for owned-force reservations. Transport `{actionId,selectedTargets,selectedInputs}`; cancellation both selections null. Reject mixed null/object, extra selections/malformed force; non-input actions send {}. Persist only after complete shared evaluation.

Resolution projects pre-resolution locked state and authorized pool/occupancy (derivable from ruleset/live journeys), revalidates full ledger before payment/mutation then creates effects. Never discard dependency errors. Worker cannot depend on API.

### Ordinary departure, continuation, payment and occupancy

Add bounded FleetMovement schema to shared Fleet; retain existing origin/destination/distance for map compatibility and enforce consistent lifecycle. Proposed optional movement data:

```ts
{
  readonly speed: PositiveNumber
  readonly departureTurn: PositiveInteger
  readonly submission: SubmittedAction // original instance, mapped targets/strength
}
```

Fleet provides live strength/origin/destination/distance; captured submission provides original source ID/selected force/action binding. Persist speed rather than reread mutable seeded content. Movement/destination/distance exist together only in transit; reject partial/corrupt states at load. Captured player matches owner; definition/instance matches persisted pool; at most one journey binds each owner/actionId. Journey ID is departing FleetId. No pending-effect array or generic workflow in I1.

Movement phase snapshots and allocates ALL new departures from stationary pre-movement sources before arrivals/merges/builds. Source 50, requests 20/15: original ID/name retains 15 stationary, two journeys 20/15. Deterministic UUID-v5 departure IDs derive from game/player/departure turn/stable action ID/source ID with documented namespace, never DB order/wall-clock/random UUID. Every departure gets such ID even full allocation; delete exhausted original. Names may retain source name on distinct IDs without incidental RNG. Snapshot avoids first order marking source moving and invalidating second legal order.

Pay resource costs once from new submissions in Pay Costs. Strength allocation transfers units, not consuming cost. Departure effect completes this turn; durable journey remains, not unresolved current effect. Existing journeys advance once each resolved turn, and new departures advance once in departure turn. Snapshot old continuation set before new departures to avoid double advancement. Progress min(speed,remaining), including owner submitting nothing. Never manufacture payable submissions for continuation.

Use a bounded movement function returning completed EffectOutcomes. Add ResolvedTurnState.resolvedContinuations: readonly { originatingSubmission: SubmittedAction; departureTurn: PositiveInteger; actionOutcomes: readonly EffectOutcome[] }[], collected canonically from the old-journey snapshot. Keep resolvedActions for new locked submissions only. Current TurnProcessor/TurnsRepository do not persist resolved-action history; do not add outcome-history tables/API for I1. Persist journey/submission/departure provenance itself, and retain continuation outcomes in the shared current-turn result. Do not append old submissions to locked set or revalidate/pay/split them again.

Cleanup must preserve zero-strength IDs for existing worker fleetIdsToDelete collection, or explicitly carry removed FleetIds in the resolution result through TurnProcessor. Simply deleting an original from turnState before the worker discovers its zero strength must not leave its DB row behind. Missing source ID during initial validation remains illegal; a deleted full-departure source is only valid as historical provenance inside an existing journey. Arrival clears destination/distance/movement. Existing friendly stationed fleet survives and receives all force; otherwise child lands. Zero fleets removed before persistence. Corrupt duplicate stationary identity should produce data failure, not arbitrary strength loss. Ordinary enemy co-location does not attack/change ownership. Ordinary traversal is canonical under submission/row permutations. Preserve transient 20-tick metadata: zero-distance distinct planets tick 0, exact-speed arrival tick 20, ceil(last distance/speed*20). I1 does not establish Assault/Colonize priority/pending intent; I2 introduces chronological coordination/provenance before those mechanics consume it.

Occupancy derives from live movement by owner/actionId, not definition. Next-turn instances remain visible as IN_PROGRESS with fleet/destination/distance; not submitted and reserve no costs/force anew. Shared eligibility rejects occupied instance. API rejects submit/edit/cancel/redirect, including null cancel BEFORE normal cancellation branch. Another instance of same definition can move remainder; moving child cannot be source. Removing movement on arrival/merge/destruction releases instance for next collecting turn; no stale lock table. Future destruction semantics deferred, but removed journeys release derived occupancy now.

### Persistence, migration and locking

Add actions.selected_inputs JSON and fleets.movement JSON; retain existing movement columns. Update game-start inserts, selections/updates, player-view projection, worker load/save/outcomes and next-turn actions, all schemas/stubs. Explicit null/{} by state. Use snake_case SQL names, app-supplied values/structural constraints only; no new SQL business defaults/numeric checks. Extend existing GameplayRepository/TurnsRepository/RulesetsRepository; no new persistence service.

Generate named migration `pnpm --filter backend db:generate --name fleet-action-inputs-and-movement`; inspect SQL/snapshot/journal; execute fresh chain via boot/migration paths on PGLite and isolated PostgreSQL. No backfill/users; preparation contains no gameplay. Reseed/reset ONLY assigned isolated database through existing worktree scripts if needed, with resolved target verification; never main/shared database or env changes. No broad production conversion/versioning. Report unforeseen migration compatibility problems.

Acquire current turn row FOR NO KEY UPDATE before decision reads; reload full submissions/resources/entities, validate and mutate within SAME transaction/context. Cancellation shares Ready/deadline/turn locking. No game lock/per-fleet mutex. Readiness closure, deadline promotion and processing retain turn-row serialization. Real PostgreSQL concurrency is mandatory; PGLite cannot prove locks.

Initially illegal or corrupt locked submissions fail authoritative validation; persist no partial state. Corrupt continuation is data/engine failure. Expected later gameplay invalidation (dead/understrength colonizer or already-claimed target) completes Prevented with explanation/paid departure resources retained in later increments. I1 must not relabel illegal inputs Prevented to pass a turn.

### Implementation steps and risks

1. Add input brands/schemas, concrete dependent constraints and effect/input mappings; validate composition; update all content/stubs with explicit inputs/ranges.
2. Implement shared evaluator/ledger/distance predicate and delegating old validation/resource helpers. Cover complete/partial decisions and arbitrary slot tags first.
3. Persist selected inputs/bounded journeys, named migration; update API/worker/game-start mappings, DTO/contracts and provenance/occupancy types.
4. Fix API replacement/cancel full-state evaluation under turn lock; backend view uses shared commitments/eligibility and derives instance status.
5. Implement snapshot departures, once-per-turn continuation, costs once, full allocation cleanup/arrival/merge/outcomes and next-turn release, retaining fixed phase order.
6. Integrate numeric ActionCard controls/dependent candidate evaluation, payload hooks, commitment presentation, in-progress cards, accurate existing fleet/map views; focused stories and one browser flow. No attack/colonize controls.
7. Add scenario/API/PostgreSQL concurrency/migration regressions below. Update existing Systems001/003/010/012/015, indexes and architecture turn guides; glossary for actual introduced Input Slot/Tag/Journey terms. Keep partial status where arrival coordination/other mechanics remain. Do not rewrite System008 before Colonize ships.
8. Run gates, inspect full diff from base including untracked migrations/tests, report criterion mapping/gaps and stop writing for independent roles.

Main risks: incomplete dependency data, doubly subtracted resources, source allocations after earlier movement/merge mutation. Full snapshots and one ledger address these. Journey model intentionally narrow, extended with supported arrival intents in I2. No genuine design/ADR blocker identified. Escalated normal-account writes/Git/Docker may be necessary outside sandbox root; never fall back to main checkout.

## Acceptance contract

Every original I1 criterion and added ordinary lifecycle criterion is mandatory. Explicit expected values, stubs, real production seams and whole Result assertions. API setup/observation uses routers, stable Test Ruleset/fixed galaxy seed and actual turns; no direct SQL/test repositories for API slices. Concurrency uses real PostgreSQL.

Commands: S `pnpm --filter shared test`; B `pnpm --filter backend test --project integration`; C `pnpm --filter backend test --project concurrency`; U `pnpm --filter backend test --project unit`; F `pnpm --filter frontend storybook:test`; E `pnpm --filter frontend e2e` (focused new spec appropriate, skill followed through exit). Focused file suffix arguments during development; full applicable suites gate acceptance.

| ID    | Independent Given / When / Then                                                                                                                                                                                                                                                                                                                                       | Layer/command                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| I1-01 | Given equal normalized state/draft through actual frontend, API and resolution projections, when evaluated then status/issues/candidate legality/resource and strength commitments agree. Repeat partial/complete and alternate ruleset parameters.                                                                                                                   | S+B+F, actual adapters/public boundaries, not three aliases |
| I1-02 | Given stationary owned strength 50/ample resources, when independent instances reserve 20+30 then both succeed/available 0; 20+31 rejects with no persisted change. Repeat different definitions and two IDs referencing same definition.                                                                                                                             | S+B                                                         |
| I1-03 | Given 20+30, when replace first with 19 then total49/available1, not69; replace first with21 rejects/retains20+30. Cancel first: total30/available20; attempting21 still rejects (51), attempting20 succeeds. Cancel both: available50. Resource exclusion follows same replacement identity.                                                                         | S+B+F                                                       |
| I1-04 | Given Influence6/Fuel4 and Standard3/1 plus Improved3/3, when both selected then commitments6/4/remaining0/0; third3/1 rejects. Edit Standard counts once; cancel releases3/1. Same-turn resource gain cannot finance costs.                                                                                                                                          | S+B, resource presentation F                                |
| I1-05 | Given source(0,0), range5 and destinations(3,4)/(3,4.001), when chosen then first eligible/second ineligible. Change source to(0,10): first now invalid. Different planet at(0,0) eligible; origin itself rejects. Missing source means dependency-incomplete destination.                                                                                            | S+B+F                                                       |
| I1-06 | Given enemy/nonexistent/wrong-game/moving/exhausted sources, when chosen then consistently reject. Wrong-game uses actual other-game ID at router seam. Missing origin data cannot bypass range.                                                                                                                                                                      | S+B+F                                                       |
| I1-07 | Given force input, missing means UI incomplete/API rejection; 0,-1,1.5,NaN,Infinity/unsafe integer fail shared parsing (transport rejects unencodable values); 51 on strength50 rejects; 1/50 succeed unreserved. Unknown tags/wrong entity types reject. Blank never becomes full strength silently.                                                                 | S+B+F                                                       |
| I1-08 | Given tags originForce/landingSite/input units mapped by roles, when evaluate/resolve then same behavior. Schema rejects wrong/missing mappings/infinite values/unused numeric controls/two moves sharing allocation. Two instances still work; move plus supported resource gain composes.                                                                           | S+U                                                         |
| I1-09 | Given strength50 and requests20/15, when resolve then original stationary15, distinct deterministic children20/15. Permuted submissions preserve IDs/state. Total50 departure removes original in shared state AND persisted PostgreSQL/player view after worker save/reload; no zero phantom or stale source row. Input20 never moves50.                             | S+B                                                         |
| I1-10 | Given speed2/distance5/force20, depart leaves remaining3; reload/resolve no submissions leaves1; reload/resolve again lands20/no movement. Departure3Influence/1Fuel paid once, never continuation (separate unrelated income). Empty effect pool each turn; continuation outcomes retain action/departure turn.                                                      | S+B, actual worker persistence                              |
| I1-11 | Given transit journey, next turn instance IN_PROGRESS with destination/distance; API submit/edit/cancel/redirect reject including null cancel. Other same-definition instance can move remainder, moving child cannot. After arrival instance available next collecting turn.                                                                                         | S+B+F+E                                                     |
| I1-12 | Given friendly stationed7/arriving20, arrival preserves stationed ID/name/strength27, removes child/releases instance. Enemy stationed7 instead: enemy7 and arrival20 remain, ownership unchanged/no combat.                                                                                                                                                          | S+B                                                         |
| I1-13 | Given fresh isolated PostgreSQL migration chain, start/submit/reload/resolve round-trips inputs/journeys through JSON/mappers and a full-force departure removes its source row after reload. Stationary fields consistent; corrupt partial journey/duplicate occupancy reports data failure. Same input/RNG replay gives same IDs/state/payment/no duplicated units. | B+C PostgreSQL round-trip; U corruption                     |
| I1-14 | Given real PostgreSQL strength50, simultaneous independent reservations30/30 yield exactly one success/stored30/available20; concurrent20/30 both succeed/total50. Resource-only and mixed-force/resource races never exceed either budget. Harness start gates create overlap, not sequential promises.                                                              | C, mandatory real Testcontainers                            |
| I1-15 | Given PostgreSQL submission racing unanimous readiness or deadline closure, whichever takes turn lock first determines acceptance: accepted-before-close captured in locked set, or close-first rejects; no post-AWAITING_PROCESSING write. Cancel/replace same lock; Ready edits reject. Preserve existing closure cases.                                            | C, readiness/deadline-worker seams                          |
| I1-16 | Given Standard speeds0.1/1/5/ranges5/10/25, UI/targets/API/resolution use data values. Speed2 distance2 yields tick20; coincident distinct planets tick0; distance0.5 speed2 tick5. Fixed phases; ordinary move never combat.                                                                                                                                         | S+B+F                                                       |
| I1-17 | Given browser stationary fleet, enter partial force/change source/observe dependent choices/submit/process/reload: origin remainder, journey strength/distance and occupied card match backend; next-turn instance releases at completion. Blank/invalid force prevents submit.                                                                                       | E+focused F                                                 |

Orchestrator spot checks: inspect evaluator at all three boundaries/no action-ID/name/tier branches; independently run I1-02/05/09/10/14/15 evidence; inspect real PostgreSQL output; browser/Storybook draft and in-progress state; migration SQL/snapshot/next-turn mapper; full increment diff/reports from base.

Quality gates: `pnpm exec oxfmt --write` changed files; `git diff --check`; `pnpm lint`; `pnpm typecheck` plus shared/backend/frontend package typechecks; full S/U/B/C; frontend build; full Storybook tests and affected E2E specs. Storybook build uses required reviewed exact-prefix escalation. Windows C runs require_escalated per backend AGENTS. Follow runners through exit/service cleanup. Never claim concurrency from PGLite. Orchestrator updates PR #595 only after gates/reviews; final delivery requires latest-head green CI.

## Handoff reports

Reports go only to orchestrator-assigned separate reports/ files. Do not treat prior role narratives as correctness evidence or modify packet without orchestrator-approved revision.

- Implementer: changed files, I1-to-test mapping, commands/exit codes, gaps/deviations/finding IDs addressed; stop writing before independent roles.
- Tester: independent coverage/explicit oracles, test-only scope statement, concrete failing regression/reproduction/commands; separate infrastructure failures.
- Reviewer: entire tracked/untracked diff from base; actionable findings IDs/location/trigger/impact/criterion or ADR, or explicit no-actionable-findings verdict.
- Orchestrator: approved version, report links, finding dispositions/exact verification in run-state; current-diff gates before commit. Older-diff report cannot approve later edits.
- Commit/push/PR/CI: orchestrator only. Planner edits no production/tests/run-state and makes no commit/push.
