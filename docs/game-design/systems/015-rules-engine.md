# Rules Engine

## Status

Partially Implemented

- [x] Data Driven Rules Engine
- [x] Standard Ruleset
- [x] Effect Outcomes
- [x] Production Turn Processing Integration
- [ ] Data Driven Frontend
- [ ] Available Actions & Multiple Actions

## Purpose

The Rules Engine turns declarative Action Definitions into deterministic game-state changes. It lets designers build readable Actions from reusable Mechanics while preserving an explicit resolution order.

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

| Concept                   | Definition                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ruleset                   | The persisted rules used by one game, including its Action Definitions, Mechanics, and other game settings.                                                  |
| Action Definition         | Declarative content that describes an Action's presentation, Mechanics, source and input requirements, and target slots.                                     |
| Available Action Instance | A currently usable instance of an Action Definition, including its identity and the exact source, input, and target candidates the server currently permits. |
| Action Submission         | A player's proposed use of an Available Action Instance, including the selected source, inputs, and targets.                                                 |
| Resolved Action           | An Action Submission and its Effect Outcomes after the Turn has been resolved.                                                                               |
| Mechanic Definition       | The contract for one reusable kind of game behavior, including its supported values and required source, input, and target data.                             |
| Mechanic                  | A configured use of a Mechanic Definition within an Action Definition.                                                                                       |
| Effect                    | A concrete attempt to apply game behavior produced from a Mechanic during Turn Resolution.                                                                   |
| Effect Outcome            | The recorded result of resolving an Effect: either `Resolved` when applied or `Prevented` as an expected game result.                                        |
| Effect Pool               | The complete working collection of unresolved Effects for the current Turn Resolution.                                                                       |
| Phase                     | An engine-owned, ordered stage of Turn Resolution that determines when a category of Effects can resolve.                                                    |

## Rules

### Action Boundary

The rules boundary is:

1. A Ruleset persists Action Definitions. Each definition contains the Action metadata (id, name, tier, etc.), its composed Mechanics, its source and input requirements, and its target slots.
2. For each player and Turn, the server evaluates the current game state and produces Available Action Instances.
3. For every Available Action Instance, the server sends the exact currently valid candidates for every target slot, as well as the permitted source and input choices. The client displays and submits these choices; it does not derive legality from player state.
4. An Action Submission identifies the Available Action Instance and the player's selected source, inputs, and targets.
5. The server validates the Action Submission when it is received and validates the locked submission again during Turn Resolution. Client-provided choices are never trusted as proof of legality.
6. During Turn Resolution, each valid locked submission's composed Mechanics produce Effects for the Effect Pool.

An Action Definition is reusable rules content. An Available Action Instance is a server-authorized opportunity to use that content in the current state. An Action Submission is the player's chosen use of that opportunity. Keeping these concepts separate allows multiple instances of the same definition while preserving server authority.

### Current Ruleset Scope

Production Turn Resolution currently uses the developer-authored Standard Ruleset directly for every game. Persisting a fixed Ruleset snapshot per game remains planned; lobby selection and player authoring are not part of the current scope.

### Future Ruleset Capability

The data-driven model leaves a future path for the engine to host multiple games simultaneously, each using a different alternate mode, including player-authored Rulesets. A single game still uses one fixed Ruleset. Ruleset definitions require validation and versioning before custom authoring can be safe.

### Effect Resolution

Turn Resolution creates one Effect Pool from locked Action Submissions and automatic game rules. The Rules Engine resolves that pool through this fixed, engine-owned Phase order:

| Phase        | Responsibility                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Pay Costs    | Validate and apply the costs committed by locked Action Submissions.                                                  |
| Movement     | Resolve Fleet Movement and chronological arrivals through the 20 Ticks defined by [System 001-turns](./001-turns.md). |
| Combat       | Resolve hostile Fleet encounters after Movement.                                                                      |
| Planet       | Resolve Planet activities.                                                                                            |
| Colonization | Resolve attempts to claim Unclaimed Planets after Movement and Combat.                                                |
| Income       | Resolve Resource production and other recurring gains.                                                                |
| Victory      | Resolve the winning player, if any.                                                                                   |

The Phase sequence belongs to the Rules Engine and is the same for every Ruleset. Each Phase is free to collect, order, coordinate, and resolve its Effects in the way that Phase requires.

Phases are coarse ordering boundaries. Ticks are finer ordering steps used inside the Movement Phase; a Tick is not a Phase, and the other Phases do not each receive 20 Ticks.

Each Effect belongs to a Phase that will orchestrate its resolution. A Mechanic may create, modify, cancel, or make a later Effect invalid.

Random-seeming outcomes, such as selecting among tied candidates, use deterministic random values derived from persisted game data. The same Ruleset and game inputs therefore produce the same result.

Pay Costs occurs before downstream Effects. A later cancellation or invalidation does not imply a refund: Influence and other Resource treatment follows [System 003-actions](./003-actions.md), [System 014-resources](./014-resources.md), and the relevant Action Definition. Actions that can receive refunds are done via using a refund Mechanic in their definition.

After the final Phase, the Effect Pool must be empty. Remaining Effects indicate an invalid Ruleset, an unsupported interaction, or an engine defect. They must not be silently ignored.

### Effect Outcomes and Failed Resolution

Every Effect that resolves normally records an Effect Outcome. `Resolved` means the Effect was applied. `Prevented` is also a completed, expected game result, such as losing a competition with another Effect; it does not fail Turn Resolution. Outcomes are grouped under the corresponding Resolved Action.

Effect Outcomes support both debugging and player-facing explanations of previous Turns. A player can inspect all outcomes produced by their own Actions for the entire game. A player can also inspect outcomes from other Effects when the global visibility rules determine that those outcomes affected them, such as being attacked. Outcome visibility is outside the Rules Engine: the engine resolves Effects and records outcomes without deciding who can see them.

An Effect resolution failure or an invalid locked Action Submission indicates an engine or data defect. The Turn does not complete, remains locked, and must be retried from the same pre-resolution state with the same Action Submissions and deterministic random input. All partial state changes and Effect Outcomes from the failed attempt are discarded. Only a fully completed Turn contributes game state or player-visible outcome history.

## Potential Flaws

- A reusable Mechanic vocabulary may struggle to express exceptional Actions without becoming too generic or complex.
- Phase order and interactions between Effects can produce non-obvious outcomes unless Actions and Turn results explain them clearly.
- Sending exact legal candidates can be expensive for Actions with very large target spaces, and candidates may become stale before submission or resolution.
- Invalid combinations in Action Definitions or Mechanics can make an entire Ruleset unplayable without strong authoring-time and game-start validation.
- Persisted Rulesets need durable versioning so engine changes do not alter or strand active games.
