# Fleets

## Purpose

Fleets are simple mobile military units. They provide an empire's presence beyond its Planets and participate in travel, combat, colonization, and other fleet-related systems.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 012-travel](./012-travel.md)
- [System 011-combat](./011-combat.md)
- [System 008-planets](./008-planets.md)
- [System 013-cloaking](./013-cloaking.md)

## Core Concepts

| Concept          | Definition                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| Fleet            | An empire's combined mobile force at one location, represented by Strength. |
| Visible Strength | A positive whole number representing a Fleet's visbile military capacity.   |
| Cloaked Strength | A positive whole number representing a Fleet's hidden military capacity.    |
| Total Strength   | A positive whole number representing a Fleet's total military capacity.     |

## Rules

A Fleet whose Total Strength reaches 0 disappears. Fleet Strength has no maximum. An empire has at most one Fleet at a given location. When fleets owned by the same empire meet at a location, they merge automatically into one Fleet with their combined Strength.

To move a Fleet, the player selects a positive amount of its Strength. That Strength departs as the moving Fleet, while any remaining Strength stays at the origin.

New Fleets can only be built at Planets owned by their empire. A new fleet can appear anywhere as a result of a split.

When a Cloaked Fleet merges with a another Fleet, it adds its Strength to the Cloaked Strength. Other players only see the Visible Strength. If there is 0 Visible Strength, other players don't see the Fleet at all.

## Potential Flaws

A single-stat unit model may not provide enough tactical variety once fleet gameplay expands.
