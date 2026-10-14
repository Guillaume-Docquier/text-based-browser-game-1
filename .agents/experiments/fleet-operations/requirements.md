# Requirements and scope

## Authority and delivery

This file records the human's decisions from the preparation conversation on 2026-10-10. It intentionally supersedes the older colonization design in System 008 for this experiment. Implement the agreed behavior and update the affected existing System documents; do not ask again about these resolved choices.

Deliver playable movement, normal fleet combat, and colonization through the shared engine, backend persistence/API, and frontend. Every increment passes plan, implementation, independent test review, independent code review, and orchestrator verification before its commit. The whole run ends with one open PR and green CI at its latest head. Do not merge or enable auto-merge.

## Hard architecture requirements

1. Actions are ruleset data composing game-owned mechanics and target constraints. Supported effects and phase order are engine-owned. There must be no behavior selected by Standard/Test action IDs, action names, tiers, or UI labels.
2. Frontend target selection and affordability, API submission validation, and turn-resolution validation use the same shared eligibility logic. Adapters can project data but cannot reimplement decisions. Evaluation uses the appropriate current state at each boundary; equal inputs must give equal decisions.
3. Dependent targets, selected strength, committed resources, and strength already allocated by other submissions are part of this shared evaluation. Editing replaces the old submission; cancellation releases its reservations. Never count the edited submission twice.
4. Ruleset parameters and declarative constraints own speed, maximum distance, costs, and the colonization strength requirement (20 in shipped content). Runtime mechanics enforce their meaning; the frontend must not hardcode these numbers.
5. Follow accepted ADRs, scoped AGENTS.md, native TypeScript boundaries, deterministic RNG, and the existing phase order. Shared gameplay stays in packages/shared; persistence and official Standard content stay in the backend.
6. Expected gameplay prevention completes an effect with an explanatory Prevented outcome. It must not poison an otherwise valid turn. Corrupt or initially illegal submissions still fail authoritative validation.

## Movement

- A player chooses an owned stationary fleet, a positive whole-number amount of its strength, and a destination planet.
- Partial movement leaves the unselected strength at the origin. Selecting all strength leaves no zero-strength fleet there.
- Several movement orders may draw from the same stationary source in one turn, including different movement action definitions. Their combined selected strength must be affordable. Validate resource and strength commitments together and serialize authoritative updates using the existing turn lock.
- A fleet already in transit cannot receive another movement order. The stationary remainder can supply further orders within its available strength.
- Each movement action has a finite maximum travel distance and only planets within that distance are selectable and accepted. Range depends on the selected source. Use the existing planet-to-planet distance model consistently.
- Each turn automatically advances an in-transit fleet by min(configured speed, remaining distance), including turns in which its owner submits nothing.
- The initiating available action instance stays occupied while the movement is in progress. It cannot be reused for another fleet or have its in-progress order cancelled, edited, or redirected.
- Continuation, action binding, departure selections, speed, destination, remaining distance, and pending arrival effects must survive persistence and reloading.
- Movement establishes chronological arrival order using the documented 20 movement ticks. All movement finishes before Fleet Build and Fleet Combat.
- Same-owner arrival merging and zero-strength cleanup remain supported. Pending effects must follow the actual surviving fleet identity; merging cannot lose, duplicate, or incorrectly redirect an order.
- Ordinary Move does not cause combat by itself.

## Assault

- Combat occurs only through an explicit Assault effect composed into an action, normally movement plus assault on arrival.
- No Surprise Assault, cloaking, or first-strike damage.
- After all movement and Fleet Build, process Assaults by arrival order. The first arriving assault's fleet is the first attacker. It fights all enemy fleets present at its destination.
- For each assault, snapshot the attacker's strength A and the combined defenders' strength D before either side takes damage. The attacker loses min(A, D); the defenders collectively lose min(D, A).
- Each side fires once per assault. Do not run rounds until elimination. Later assaults use the then-current surviving forces.
- Multiple defending fleets are required, including fleets owned by different opponents. Distribute defender losses proportionally, using whole numbers and preserving total losses exactly.
- Destroy zero-strength fleets. An attacker destroyed by a prior assault cannot execute a later attack.
- Arrival ordering is independent of incidental database row, object-property, or submission enumeration order.

## Colonization

- Compose movement and colonization using supported effects and constraints.
- The target must be unclaimed. The selected colonizing force must afford the configured strength requirement when issuing the order.
- Colonization resolves after Fleet Combat, by arrival order, using the current surviving fleet and planet state.
- Success transfers planet ownership and consumes exactly 20 fleet strength in the shipped ruleset. A strength-35 fleet leaves strength 15; a strength-20 fleet disappears.
- Strength below 20 at colonization time, including combat losses, prevents colonization. Destroyed fleets also cannot colonize.
- If an earlier valid attempt claims the planet, subsequent attempts are prevented.
- Failed attempts spend no colonization strength; surviving fleets stay at the destination. There is no return trip.
- Do not add population, a Colony resource requirement, Colony production, or colonization growth bonuses. The repository already stores and displays an unused COLONY resource; removing that unrelated catalogue entry is outside this experiment.
- Being at the same planet as an enemy does not by itself prevent colonization or trigger combat; use the explicit Assault mechanic and the agreed colonization constraints.

## Working defaults for the autonomous planner

These are implementation defaults, not additional human answers. Refine technical details in the approved increment packet without expanding the agreed product scope.

- Resource costs are paid once at departure; automatic continuation does not repay or reserve them anew. Costs already paid remain spent when later gameplay prevents an effect, unless the action explicitly composes a supported refund.
- Release the action instance after its journey and arrival effects finish, for use in the next collecting turn. Destruction or other terminal prevention must also release it.
- Strength spent by successful colonization is a deferred cost checked at the colonization phase, not a departure deduction. Initial eligibility and final eligibility share the same requirement predicate against different current state.
- Preserve the documented deterministic random choice among otherwise eligible colonization attempts arriving in the same tick. For tied Assaults, use a documented seeded ordering. Canonically order candidates before drawing RNG.
- Proportional losses use largest remainders with a stable fleet-ID tie-break, unless the planner demonstrates an equally simple deterministic rule that preserves exact totals.
- Preserve existing friendly merging semantics: effects follow the surviving merged fleet and use its current strength. Record arrival provenance separately so merges cannot erase priority. Consume 20 from that surviving fleet exactly once for the winning attempt.
- Reject no-op movement to the source planet. Do not reject distinct planets merely because they have coincident coordinates; handle zero-distance arrival deterministically.
- A stationary fleet already at an unclaimed planet may colonize through a supported stationary colonization composition, using tick 0, if needed for usable gameplay. This must reuse the same Colonize mechanic; it must not invent a special endpoint.
- Preserve the existing three Move variants' costs and speeds unless balancing is necessary for a usable feature. Supply explicit finite ranges as ruleset data. Start new ordinary Attack Move and Colonize content from the documented standard costs/speeds/ranges, removing Colony costs and using strength 20 for colonization. The planner records the concrete values it chooses before implementation.
- UI scope covers strength input, dependent targets, valid/invalid availability, action-in-progress presentation, journeys, surviving strengths, and planet ownership. Reuse existing action/fleet/map views. Do not build a new combat replay or full historical outcome browser solely for this experiment.
- Add useful composed-action regression tests, including movement plus assault plus colonization, without requiring every supported composition to become a new Standard action.

## Exclusions and escalation

Excluded: Surprise Assault, cloaking, diplomacy, planet conquest, population and automatic development, ideology action pools, ruleset versioning, engine versioning, and a general scripting language.

Do not weaken the hard architecture requirements to finish faster. When an unresolved game-design or accepted-ADR contradiction materially blocks implementation, ask at most two concise questions and continue independent work. No further approval is needed for the decisions recorded above, routine implementation choices, commits, pushing the experiment branch, opening/updating its PR, or fixing its CI. New GDDRs or System documents still require explicit human approval.
