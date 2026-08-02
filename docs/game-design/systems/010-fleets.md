# Fleets

## Purpose

Fleets are simple mobile military units. They provide an empire's presence beyond its Planets and participate in travel, combat, colonization, and other fleet-related systems.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 012-travel](./012-travel.md)
- [System 011-combat](./011-combat.md)
- [System 008-planets](./008-planets.md)

## Core Concepts

| Concept           | Definition                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| Fleet             | An empire's combined mobile force at one location, represented by Strength. |
| Visible Strength  | A positive whole number representing a Fleet's visbile military capacity.   |
| Cloaked Strength  | A positive whole number representing a Fleet's hidden military capacity.    |
| Total Strength    | A positive whole number representing a Fleet's total military capacity.     |
| Cloaking Duration | The period for which a Fleet's Strength remains Cloaked.                    |

## Rules

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
