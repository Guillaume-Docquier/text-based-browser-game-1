# Initial implementation plan

This sequence seeds the planner's work. Each increment must be refined against the live code and approved by the orchestrator before implementation. Split large increments when doing so gives a coherent, independently verifiable commit; never silently drop acceptance criteria or postpone shared validation until the end.

## Read first

- Root AGENTS.md and the nearest scoped instructions before edits.
- docs/typescript-coding-standards.md, docs/glossary.md, and the installed @guillaume-docquier/tools-ts README.
- docs/architecture/decisions/README.md, then relevant accepted ADRs: 007 (sharing), 008 (DI), 011 (worker boundary), 013 (Results), 022 (frontend contracts), 025 (migrations), 026 (turn locks), 027/028 (domain schemas), 029/030 (defaults/IDs), and testing/frontend ADRs as relevant.
- docs/architecture/turn-resolution.md and turn-processing.md.
- GDDR 009 and Systems 001, 003, 008, 010, 011, 012, 014, 015, plus their indexes.
- requirements.md is the approved experiment scope. Old Colony/population/return-on-failure design does not override it.

## Baseline evidence

Inspected at e9408c64620fc988dc3b1fd39827afabcb7d40f5; verify before relying on it:

- packages/shared/src/domain/ruleset has Action/Effect Definitions and target constraints; only the ownership constraint currently exists.
- packages/shared/src/action-submission/validation exposes validateSubmittedActions, validateTargets, validateTarget, and validateCosts. Current costs are resource-only; input and cross-submission strength accounting must be added.
- apps/frontend/src/features/play/components/TargetPicker.tsx already calls shared validateTarget, but its candidates contain only type/owner data and cannot evaluate dependent distance or fleet-state constraints.
- apps/backend/src/api/gameplay contains submission validation, player views, API contracts, and persistence adapters. Ensure submission state includes all dependencies: other allocations, source planets, in-progress orders, and edited submissions.
- packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.ts currently advances only submitted moves and immediately lands/merges. It computes an arrival tick but the phase lacks chronological coordination.
- Fleet.ts stores destination and remaining distance but no persisted speed or action binding. ResolutionFleet.ts has transient arrivedAtTick.
- computeAvailableActions.ts reoffers every pool entry each turn. Stable pooled IDs can support per-instance occupancy but presently do not account for journeys.
- Fleet Combat and Colonization have phase boundaries, with no implemented mechanics.
- Backend TurnProcessor/turns.repository map and persist turn state. They must round-trip new continuation state and planet ownership without depending on API code.
- Standard content is backend-owned; shared/testing/test-ruleset owns independent stable test content.

## Increment 1: shared action eligibility and allocations

Establish one shared evaluation path for complete submissions and partial UI selections, supporting dependent source/destination targets, stationary-fleet constraints, strength input, cumulative reservations, and finite range. Integrate frontend and API adapters as part of this increment; no temporary duplicate frontend rule implementation.

The planner must choose a small domain model that distinguishes entity selections from numeric inputs and supports relevant cross-target references without hardcoded target tags. Validate malformed ruleset compositions and references at the domain boundary. Separate incomplete UI selections from illegal complete submissions.

Acceptance:

- Same normalized state yields the same target and affordability decisions in frontend, API, and resolution.
- On a source of strength 50, reservations 20 + 30 succeed and 20 + 31 fail. Cancellation and replacement release only the appropriate previous allocation. Resource overspending is also prevented.
- Changing source recomputes destination validity; exactly-in-range succeeds and just-outside fails.
- Enemy, nonexistent, wrong-game, moving, and exhausted sources are rejected consistently.
- Missing, zero, negative, fractional, and excessive strength inputs are rejected appropriately.
- Distinct action instances sharing a definition remain independently usable.
- Real PostgreSQL concurrency coverage demonstrates that simultaneous reservations cannot overspend the same source; submission/turn-closure locking remains valid.

If runtime splitting cannot be separated cleanly from input support, include the minimal split execution here or combine the necessary part of increment 2. Do not commit a player-visible action input that the engine silently ignores.

## Increment 2: complete movement lifecycle

Implement partial departures, automatic continuation, persisted per-instance action occupancy, tick-ordered arrivals, terminal cleanup, and safe friendly merges. Add finite ranges to shipped Move content. Complete persistence, API view, and frontend presentation together.

Use bounded game-owned continuation data appropriate for the composed arrival mechanics that follow. Avoid a generic workflow engine. A deferred arrival effect is persisted between turns and activated in its existing phase; it must not remain as an unresolved current-turn effect that fails the empty-pool invariant.

Acceptance:

- At speed 2 and distance 5, one order travels 2, 2, 1 over three resolutions without resubmission, with costs paid once.
- Splitting 20 and 15 from strength 50 leaves 15 at origin and two independent journeys. Full allocation leaves no phantom fleet. IDs and resulting state are deterministic.
- Reload between every turn preserves the journey, its action lock, remaining distance, speed, and arrival intent.
- The initiating action is locked across turns; another action can move the stationary remainder but cannot retarget an in-transit fleet.
- Reject API attempts to cancel/edit/reuse the occupied action. It becomes available after completion, including destruction/prevention paths once introduced.
- Arrivals use the 20-tick ordering, including exact-turn arrival, sub-tick ties, zero-distance distinct planets, and final fractional movement.
- Same-owner arrivals and existing stationed fleets merge safely; pending effect identity and arrival provenance survive merging.
- Existing fleet tables and maps remain accurate through departure, transit, arrival, and cleanup.
- A focused browser flow submits partial movement and observes continuation and action availability across turns.

## Increment 3: normal Assault

Implement a reusable Assault definition/effect, chronological Fleet Combat coordination, proportional defender loss, and ruleset-composed Attack Move. Preserve the engine-owned phase order; combat sees all arrivals and same-turn fleet builds.

Acceptance:

- A=30, D=20 ends with attacker 10 and defenders 0. A=20, D=30 ends with attacker 0 and defenders 10. A=D destroys both. These use pre-damage strengths.
- Several defending fleets take whole-number proportional losses with exact total loss, deterministic rounding, and no negative strength.
- Three-player scenarios combine all enemies as defenders for each assault.
- Multiple assaults resolve by arrival, irrespective of input enumeration order; ties replay deterministically. Subsequent assaults use surviving forces.
- Ordinary Move does not attack. No defenders is a successful no-op. An attacker already destroyed is Prevented, not a failed turn.
- Movement plus Assault persists over multiple turns and executes only on arrival, exactly once, including merge and action-release cases.
- API persistence, frontend fleet strengths/disappearance, and a focused browser combat scenario match engine outcomes.

## Increment 4: colonization through composition

Implement shared colonization eligibility, deferred strength consumption, mutable ownership and persistence, and movement-plus-colonization ruleset content. No new resource or population behavior.

Acceptance:

- 20 strength succeeds, becomes zero and is cleaned up; 35 succeeds and leaves 15. Owner changes persist and appear in the frontend.
- Below 20 cannot submit; a force initially eligible but reduced below 20 in combat arrives and is Prevented without extra strength loss.
- Combat occurs before colonization. A dead colonizer is Prevented. A surviving failed colonizer remains at destination.
- Earliest valid arrival wins; earlier invalid attempts do not block later valid ones. Same-tick eligible contenders use persisted deterministic RNG.
- A target claimed during a multi-turn journey prevents arrival colonization without breaking continuation or failing the turn.
- Failed competitors consume no strength. One success consumes strength exactly once even after same-owner merges.
- Resource costs are paid once. Colony stockpile and population do not participate.
- Changed strength requirements in an alternate test ruleset change all three validation surfaces and resolution behavior without production code changes.
- Composed movement + Assault + Colonize works, including combat reducing an otherwise valid colonizer below its requirement.
- Browser coverage observes successful ownership change and a prevented competing or damaged attempt.

## Increment 5: full integration and delivery

Close gaps in multi-turn persistence, phase interactions, visibility of results, and docs. Update existing Systems, their indexes, and relevant architecture explanations to distinguish implemented scope from remaining planned mechanics. Do not mark all Fleets/Planets functionality implemented when cloaking/development remain planned.

Acceptance:

- A complete multi-player scenario exercises several partial departures, range filtering, in-progress locks, combat, contested colonization, failure, and next-turn reuse.
- Equivalent same-state evaluations are exercised at frontend, API, and resolution boundaries; test mutated ruleset parameters and multiple instances of the same definition.
- Reload/retry from identical input and RNG gives identical results; no duplicated payment, movement, assault, colonization, or strength creation.
- The reviewed diff includes appropriate schemas/migrations/stubs, persistence adapters, frontend behavior, and synchronized documentation.
- Required local checks and the repository CI workflows pass. One open PR contains all increment commits and is ready for human review.

This increment is for integration evidence and remaining defects, not a place to defer required behavior from earlier increments. If it changes no files because every requirement is already satisfied, record its verification in a small final evidence/documentation commit.

## Verification strategy

Use the smallest meaningful layer for each regression and a few full flows for integration. Keep written expected values independent of production calculations.

- Shared deterministic scenario tests: mechanics, ordering, arithmetic, composition, validation parity, and state transitions.
- Backend router integration tests: public submission/observation and persistence across turns, using real production repositories and the stable Test Ruleset.
- Backend concurrency tests on real PostgreSQL: aggregate strength/resource reservations and turn locks.
- Storybook browser tests: strength input, dependent target changes, availability and in-progress UI. Load storybook-agent-workflow before UI work.
- Playwright E2E: user-level successful and prevented flows. Load run-e2e-tests and playwright/AGENTS.md; follow the runner until it exits, including server cleanup.

Derive commands from current package scripts and CI. Common gates include pnpm exec oxfmt --write on changed files, pnpm lint, workspace/package typechecks, shared tests, backend unit/integration tests, affected concurrency tests, frontend build, and applicable Storybook/E2E runs. Run the complete applicable suites before delivery. Do not rerun already green checks without changed inputs or a concrete concern.

The tester reviews and edits tests only. It can inspect public interfaces and test harnesses to exercise behavior, but code review and production fixes belong to the reviewer and implementer respectively.
