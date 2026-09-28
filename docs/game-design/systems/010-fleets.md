# Fleets

## Status

Partially Implemented

Build Fleet Actions create and reinforce stationed Fleets. Move Fleet Directives are now available, but the full movement lifecycle remains incomplete. The Fleets view and Star System markers show Fleets. Combat, splitting, cloaking, and colonization remain planned.

## Purpose

Fleets are simple mobile military units. They provide an empire's presence beyond its Planets and participate in movement, combat, colonization, and other fleet-related systems.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 001-turns](./001-turns.md)
- [System 012-movement](012-movement.md)
- [System 011-combat](./011-combat.md)
- [System 008-planets](./008-planets.md)
- [System 015-rules-engine](./015-rules-engine.md)
- [System 014-resources](./014-resources.md)

## Core Concepts

| Concept           | Definition                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| Fleet             | An empire's combined mobile force at one location, represented by Strength. |
| Visible Strength  | A positive whole number representing a Fleet's visible military capacity.   |
| Cloaked Strength  | A positive whole number representing a Fleet's hidden military capacity.    |
| Total Strength    | A positive whole number representing a Fleet's total military capacity.     |
| Cloaking Duration | The period for which a Fleet's Strength remains Cloaked.                    |

## Rules

### Current Implementation

A player can submit a Build Fleet Directive targeting one of their owned Planets. The server validates the target and combined Action costs when the submission is made, then validates locked submissions again during Turn Resolution. Pay Costs precedes Fleet Build. The available Standard Ruleset versions and their temporary balance values are recorded in [System 003-actions](./003-actions.md).

The Standard Ruleset also offers three Move Fleet Directives. Each targets an owned Fleet and a destination Planet. Their current speeds and costs are recorded in [System 003-actions](./003-actions.md). Range limits and partial-Strength movement are not yet enforced.

Fleet Build creates a Fleet with the Action's Strength, or adds that Strength to the same player's existing Fleet at the target Planet. It does not merge with another player's Fleet there. A new Fleet's ID is deterministic from the Game, Player, Planet, and creation Turn; reinforcement keeps the existing ID and name. New names are deterministic random values of the form `fleet <number>`.

The player view currently exposes every Fleet in the Game to every player, including its name, owner, Strength, and origin Planet. The Fleets view can search names, filter by owner, sort its columns, and open the origin Planet in the Galaxy view. The Star System map shows each Fleet beneath its Planet's label with an owner-colored icon and Strength. No Fleet marker appears on the galaxy-wide map. Movement location is not yet presented correctly; the view still uses the origin Planet. Cloaked Strength and visibility restrictions are not implemented.

### Planned Fleet Lifecycle

A Fleet whose Total Strength reaches 0 disappears. Fleet Strength has no maximum. An empire has at most one Fleet at a given location. When fleets owned by the same empire meet at a location, they merge automatically into one Fleet with their combined Strength.

To move a Fleet, the player selects a positive amount of its Strength. That Strength departs as the moving Fleet, while any remaining Strength stays at the origin.

New Fleets can only be built at Planets owned by their empire. A new fleet can appear anywhere as a result of a split.

### Cloaking

Cloaking creates hidden Fleet movement and information asymmetry. Enemy players cannot see or target Cloaked Strength. When a Fleet has 0 Visible Strength, Enemy players cannot see the Fleet or know its location.

When a Cloaked Fleet merges with another Fleet, its Strength remains Cloaked in the resulting Fleet. The owning player sees both Visible Strength and Cloaked Strength; Enemy players see only Visible Strength.

Cloaked Strength participates fully in Combat. A Fleet can attack or defend while Cloaked, but all its Cloaked Strength becomes Visible if it is involved in Combat. Cloaked Strength otherwise remains Cloaked for its Cloaking Duration.

## Potential Flaws

A single-stat unit model may not provide enough tactical variety once fleet gameplay expands.

Cloaking may create frustrating attacks without enough detection, warning, or counterplay systems.
