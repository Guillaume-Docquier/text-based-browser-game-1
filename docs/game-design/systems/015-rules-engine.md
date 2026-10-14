# Rules Engine

## Status

Partially Implemented

- [x] Data Driven Rules Engine
- [x] Standard Ruleset
- [x] Ruleset persistence
- [x] Lobby Ruleset selection
- [x] Effect Outcomes
- [x] Production Turn Processing Integration
- [x] Data-driven frontend Action presentation
- [x] Resource stockpile and affordability presentation
- [x] Available Actions
- [x] Ruleset-defined Action Pool with stable Action IDs
- [x] Frontend target selection for Build Fleet's owned Planet, Move Fleet's Fleet/destination, and Colonize's Fleet/Unclaimed Planet targets
- [x] Fleet Build Effect and resolution Phase
- [x] Move Fleet Effect with partial allocations and persisted automatic continuation
- [x] Normal Fleet Assault Effect with deterministic combat and arrival-bound composition
- [x] Fleet Colonize Effect with shared eligibility, stationary reservations, and arrival-bound composition
- [x] Typed positive-integer Action inputs and movement-composition validation
- [x] Shared Action eligibility at frontend selection, API submission, and locked resolution
- [x] Per-instance Action binding during movement
- [ ] Frontend target selection for all target types
- [x] Multiple Actions

## Purpose

The Rules Engine turns declarative Action Definitions into deterministic game-state changes. It lets designers build readable Actions from reusable Effect Definitions while preserving an explicit resolution order.

Supports:

- [GDDR 009-deterministic-data-driven-rules-engine](../decisions/009-deterministic-data-driven-rules-engine.md)

Relates to:

- [System 001-turns](./001-turns.md)
- [System 003-actions](./003-actions.md)
- [System 004-ideological-alignment](./004-ideological-alignment.md)
- [System 005-political-regime](./005-political-regime.md)
- [System 006-trade](./006-trade.md)
- [System 007-contracts](./007-contracts.md)
- [System 008-planets](./008-planets.md)
- [System 009-infrastructure](./009-infrastructure.md)
- [System 010-fleets](./010-fleets.md)
- [System 011-combat](./011-combat.md)
- [System 012-movement](./012-movement.md)
- [System 014-resources](./014-resources.md)

## Core Concepts

| Concept                   | Definition                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Ruleset                   | The persisted rules used by one game, including its Action Definitions, Effect Definitions, and other game settings.     |
| Action Definition         | Declarative content describing an Action's presentation, Effect Definitions, source and input requirements, and targets. |
| Pooled Action             | An Action Pool entry with a stable Action ID and a reference to an Action Definition.                                    |
| Available Action Instance | A currently usable instance of an Action Definition offered to a player for submission.                                  |
| Action Submission         | A player's proposed use of an Available Action Instance, including the selected source, inputs, and targets.             |
| Resolved Action           | An Action Submission and its Effect Outcomes after the Turn has been resolved.                                           |
| Effect Definition         | Configured Ruleset data that defines an Effect to create during Turn Resolution.                                         |
| Effect                    | A concrete attempt to apply game behavior created from an Effect Definition during Turn Resolution.                      |
| Effect Outcome            | The recorded result of resolving an Effect: either `Resolved` or `Prevented` as an expected game result.                 |
| Effect Pool               | The complete working collection of unresolved Effects for the current Turn Resolution.                                   |
| Phase                     | An engine-owned, ordered stage of Turn Resolution that determines when a category of Effects can resolve.                |
| Target Slot               | One entry in an Action Definition's `targets` record, pairing a Target Tag with a Target Definition.                     |
| Target Tag                | The key of a Target Slot, used to look up a selected target id in an Action Submission.                                  |
| Target Role               | An Effect Definition's internal name for a target, mapped to an Action Definition's Target Tag.                          |

## Rules

### Action Boundary

The rules boundary is:

1. A Ruleset persists Action Definitions and one Action Pool. Each definition contains the Action metadata (id, name, tier, etc.), its composed Effect Definitions, its source and input requirements, and its target slots. Each Pooled Action has a stable Action ID and references a definition.
2. For each player and Turn, the server creates Available Action Instances from the Action Pool. The same Action ID identifies a pool entry across Turns.
3. The server provides each Available Action Instance and its Action Definition, including target slots and typed inputs. The client uses player-visible game state to present choices that depend on other selections; the server does not enumerate legal combinations.
4. An Action Submission identifies the Available Action Instance and the player's selected source, inputs, and targets.
5. The frontend, submission API, and Turn Resolution use the shared eligibility evaluator. The API validates a complete submission against retained submissions, and Turn Resolution revalidates the locked full set before costs or state changes. Client-provided choices are never trusted as proof of legality.
6. During Turn Resolution, each valid new locked submission's composed Effect Definitions produce Effects for the Effect Pool; previously started journeys continue through the Fleet Movement Phase without a new payable submission.

An Action Definition stores its configured Effect Definitions in `effects`. Resource-loss definitions used for payment are stored separately in `costs`; both fields produce runtime Effects.

An Action Definition is reusable rules content. A Pooled Action gives that content a stable Action ID in the Ruleset. An Available Action Instance is a server-authorized opportunity to use it in the current state. An Action Submission is the player's chosen use of that opportunity. Keeping these concepts separate allows multiple instances of the same definition while preserving server authority.

Each Action Definition target slot pairs a tag with a Target Definition containing the target type and constraints. An Action Submission stores selected target IDs under those tags. An Effect Definition names the targets it needs by role and maps each role to an Action Definition target tag; during resolution, the tag locates the selected ID. Several Effect Definitions can refer to the same slot, and one Effect Definition can be configured to use different slots in different Actions.

Enumerating every valid combination would make payloads and server computation grow quickly for Actions with dependent targets, such as a Fleet and a destination Planet in its range. Client-side choices help the player make a submission; server validation remains authoritative.

### Current Ruleset Scope

Developer-authored Rulesets are persisted and every game explicitly selects one during lobby creation. Standard is the default Ruleset, while Test provides stable automated-test content. Game start, player views, Action Submission validation, and Turn Resolution load the selected Ruleset from persistence.

As a temporary exception to the immutable, versioned direction in GDDR 009, seeded Ruleset records remain mutable. Deploy-time seed updates therefore change the Ruleset used by waiting, active, and completed games. Ruleset snapshots and versioning remain future work; player authoring is not part of the current scope.

### Future Ruleset Capability

The engine can host games using different developer-authored Rulesets. A single game selects one Ruleset. Immutable snapshots, versioning, and validation at an authoring boundary are required before player-authored Rulesets can be safe.

### Effect Resolution

Turn Resolution creates one Effect Pool from locked Action Submissions and automatic game rules. The Rules Engine resolves that pool through this fixed, engine-owned Phase order:

| Phase          | Responsibility                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Pay Costs      | Validate and apply the costs committed by locked Action Submissions.                                                |
| Fleet Movement | Advance new departures and existing journeys once, then settle all arrivals by calculated Tick and stable Fleet ID. |
| Fleet Build    | Create or reinforce a player's Fleet at the submitted Planet target with a deterministic identity.                  |
| Fleet Combat   | Resolve captured normal Assaults after all Fleet Movement arrivals and Fleet Builds.                                |
| Planet         | Resolve Planet activities.                                                                                          |
| Colonization   | Resolve attempts to claim Unclaimed Planets after Fleet Movement and Fleet Combat.                                  |
| Income         | Resolve Resource production and other recurring gains.                                                              |
| Victory        | Resolve the winning player, if any.                                                                                 |

The Phase sequence belongs to the Rules Engine and is the same for every Ruleset. Each Phase is free to collect, order, coordinate, and resolve its Effects in the way that Phase requires.

Pay Costs, Fleet Movement, Fleet Build, normal Fleet Combat, Colonization, Income, and Victory currently resolve Effects. Planet remains a Phase boundary without gameplay behavior. Colonization evaluates arriving and stationary Fleet attempts against current Planet ownership and surviving Strength after Combat; success assigns ownership and consumes the configured Strength requirement. [System 008-planets](./008-planets.md) records the current Colonization rules. The Fleet Build Effect creates or reinforces a Fleet at the submitted owned Planet; [System 010-fleets](./010-fleets.md) defines the current Fleet behavior.

The Move Fleet Effect advances only the selected Strength from an owned, stationary Fleet to a different Planet within the configured inclusive Range. The origin keeps its unallocated Strength; the deterministic child stores its Speed, departure Turn, originating Action Submission, and any captured pending Assault or Colonize definitions in movement JSON. It advances automatically once during the departure Turn and once per later Turn without repaying costs. Its Action Instance stays In Progress until arrival, when it lands or merges with the same player's stationed Fleet. Pending Assault and Colonize definitions follow their initiating arrivals through friendly merges. Assault resolves after all arrivals and Fleet Builds; Colonization then uses its recorded initiating Tick and current Planet/Fleet state. Continuation outcomes are returned for that resolution only and are not stored as action history. [System 012-movement](./012-movement.md) records the current rules.

Phases are coarse ordering boundaries. The Fleet Movement Phase calculates arrival Ticks on a 20-Tick scale and settles every arrival before Fleet Build and Fleet Combat. A Tick is not a Phase, and the other Phases do not each receive 20 Ticks. Pending Assaults keep their initiating order through friendly merges; a Fleet in transit is not present at its recorded origin.

Each Effect belongs to a Phase that orchestrates its resolution. An Effect may create, modify, cancel, or make a later Effect invalid.

Random-seeming outcomes, such as selecting among tied candidates, use deterministic random values derived from persisted game data. The same Ruleset and game inputs therefore produce the same result.

Pay Costs occurs before downstream Effects. A later cancellation or invalidation does not imply a refund: Influence and other Resource treatment follows [System 003-actions](./003-actions.md), [System 014-resources](./014-resources.md), and the relevant Action Definition. Actions that can receive refunds are done via using a refund Effect Definition in their definition.

After the final Phase, the Effect Pool must be empty. Remaining Effects indicate an invalid Ruleset, an unsupported interaction, or an engine defect. They must not be silently ignored.

### Effect Outcomes and Failed Resolution

Every Effect that resolves normally records an Effect Outcome. `Resolved` means the Effect was applied. `Prevented` is also a completed, expected game result, such as losing a competition with another Effect; it does not fail Turn Resolution. Outcomes are grouped under the corresponding Resolved Action.

Effect Outcomes support both debugging and player-facing explanations of previous Turns. A player can inspect all outcomes produced by their own Actions for the entire game. A player can also inspect outcomes from other Effects when the global visibility rules determine that those outcomes affected them, such as being attacked. Outcome visibility is outside the Rules Engine: the engine resolves Effects and records outcomes without deciding who can see them.

An Effect resolution failure or an invalid locked Action Submission indicates an engine or data defect. The Turn does not complete, remains locked, and must be retried from the same pre-resolution state with the same Action Submissions and deterministic random input. All partial state changes and Effect Outcomes from the failed attempt are discarded. Only a fully completed Turn contributes game state or player-visible outcome history.

## Potential Flaws

- A reusable Effect Definition vocabulary may struggle to express exceptional Actions without becoming too generic or complex.
- Phase order and interactions between Effects can produce non-obvious outcomes unless Actions and Turn results explain them clearly.
- Frontend target-choice logic can drift from server validation, especially when target slots depend on one another or on state the client cannot see. A [shared package](../../architecture/decisions/007-code-sharing.md) can reduce duplicated logic, but the server must still validate against authoritative state.
- Invalid combinations in Action Definitions or Effect Definitions can make an entire Ruleset unplayable without strong authoring-time and game-start validation.
- Persisted Rulesets need durable versioning so engine changes do not alter or strand active games.
