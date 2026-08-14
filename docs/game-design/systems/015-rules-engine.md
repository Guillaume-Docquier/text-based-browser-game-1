# Rules Engine

## Status

Not Implemented

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
- [System 012-travel](./012-travel.md)
- [System 014-resources](./014-resources.md)

## Core Concepts

| Concept                   | Definition                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ruleset                   | The persisted rules used by one game, including its Action Definitions, configured Mechanics, and other game settings.                                       |
| Action Definition         | Declarative content that describes an Action's presentation, Mechanics, source and input requirements, and target slots.                                     |
| Available Action Instance | A currently usable instance of an Action Definition, including its identity and the exact source, input, and target candidates the server currently permits. |
| Action Submission         | A player's proposed use of an Available Action Instance, including the selected source, inputs, and targets.                                                 |
| Mechanic Definition       | The contract for one reusable kind of game behavior, including its supported values and required source, input, and target data.                             |
| Mechanic                  | A configured use of a Mechanic Definition within an Action Definition.                                                                                       |
| Turn Plan                 | The validated, deterministic collection of Effects and submission diagnostics prepared before Phase resolution begins.                                       |
| Effect                    | A concrete state change compiled from a Mechanic, including its resolved targets, origin, Phase, and ordering data.                                          |
| Effect Pool               | The complete working collection of unresolved Effects for the current Turn Resolution.                                                                       |
| Effect Outcome            | The recorded result of resolving an Effect, such as Succeeded, Prevented, or Failed.                                                                         |
| Phase                     | An engine-owned, ordered stage of Turn Resolution that determines when a category of Effects can resolve.                                                    |

## Rules

### Action Boundary

The rules boundary is:

1. A Ruleset persists Action Definitions. Each definition contains the presentation data needed to display the Action, its composed Mechanics, its source and input requirements, and its target slots.
2. For each player and Turn, the server evaluates the current game state and produces Available Action Instances.
3. For every Available Action Instance, the server sends the exact currently valid candidates for every target slot, as well as the permitted source and input choices. The client displays and submits these choices; it does not derive legality from player state.
4. An Action Submission identifies the Available Action Instance and the player's selected source, inputs, and targets.
5. The server validates the Action Submission when it is received and validates the locked submission again during Turn Resolution. Client-provided choices are never trusted as proof of legality.
6. Turn Resolution builds a Turn Plan. It overrides server-owned targets such as self, rejects invalid locked submissions with structured diagnostics, and compiles each valid submission's Mechanics into Effects with resolved role-based targets.
7. The Turn Plan's Effects populate the Effect Pool before Phase resolution begins.

An Action Definition is reusable rules content. An Available Action Instance is a server-authorized opportunity to use that content in the current state. An Action Submission is the player's chosen use of that opportunity. Keeping these concepts separate allows multiple instances of the same definition while preserving server authority.

### Current Ruleset Scope

The current planned scope gives each game exactly one persisted Ruleset, fixed when the game starts. Initially, every new game may use the same developer-authored default Ruleset; lobby selection and player authoring are not part of this scope.

### Future Ruleset Capability

The data-driven model leaves a future path for the engine to host multiple games simultaneously, each using a different alternate mode, including player-authored Rulesets. A single game still uses one fixed Ruleset. Compatibility and versioning are deferred until multiple live Ruleset versions or migrations create a concrete need.

### Effect Resolution

Turn Resolution creates one Effect Pool from the Turn Plan and automatic game rules. The engine resolves that pool through this fixed Phase order:

| Phase         | Responsibility                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Pay Costs     | Validate and apply the costs committed by locked Action Submissions.                                                |
| Travel        | Resolve Fleet Travel and chronological arrivals through the 20 Ticks defined by [System 001-turns](./001-turns.md). |
| Combat        | Resolve hostile Fleet encounters after Travel.                                                                      |
| Governance    | Resolve changes to empire governance and Ideological Alignment.                                                     |
| Income        | Resolve Resource production and other recurring gains.                                                              |
| Colonization  | Resolve attempts to claim Unclaimed Planets after Travel and Combat.                                                |
| Check Victory | Resolve victory conditions after all other game-state changes.                                                      |

Phases are coarse ordering boundaries owned by the engine and are not configured by a Ruleset. Ticks are finer ordering steps used inside the Travel Phase; a Tick is not a Phase, and the other Phases do not each receive 20 Ticks.

Each engine-supported Mechanic type belongs to a Phase and has an explicit order relative to the other Mechanic types in that Phase. Effects use stable persisted input, rather than collection insertion order, for deterministic tie-breaking. A Mechanic may create, modify, cancel, or make a later Effect invalid, but it must do so through explicit rules whose outcome is independent of runtime iteration order.

Random-seeming outcomes, such as selecting among tied candidates, use deterministic random values derived from persisted game data. The same Ruleset and game inputs therefore produce the same result.

Pay Costs evaluates all costs committed by one player together and applies them atomically. If payment fails, its Cost Effects fail and the Action Submissions' downstream Effects are prevented. A later cancellation or invalidation does not imply a refund: Influence and other Resource treatment follows [System 003-actions](./003-actions.md), [System 014-resources](./014-resources.md), and the relevant Action Definition. Actions that can receive refunds do so through a refund Mechanic in their definition.

Every completed Effect records an Effect Outcome. Expected game results such as prevention are distinct from malformed Rulesets or violated engine invariants.

After the final Phase, the Effect Pool must be empty. Remaining Effects indicate an invalid Ruleset, an unsupported interaction, or an engine defect. They must not be silently ignored.

## Potential Flaws

- A reusable Mechanic vocabulary may struggle to express exceptional Actions without becoming too generic or complex.
- Phase order and interactions between Effects can produce non-obvious outcomes unless Actions and Turn results explain them clearly.
- Sending exact legal candidates can be expensive for Actions with very large target spaces, and candidates may become stale before submission or resolution.
- Invalid combinations in Action Definitions or Mechanics can make an entire Ruleset unplayable without strong authoring-time and game-start validation.
- Compatibility and versioning will need revisiting before multiple live engine or Ruleset versions must coexist.
