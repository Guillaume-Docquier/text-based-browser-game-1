# Fleets

## Status

Partially Implemented

## Purpose

Fleets are simple mobile military units. They provide an empire's presence beyond its Planets and participate in movement, combat, colonization, and other fleet-related systems.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 012-movement](012-movement.md)
- [System 011-combat](./011-combat.md)
- [System 008-planets](./008-planets.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept           | Definition                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| Fleet             | An empire's combined mobile force at one location, represented by Strength. |
| Visible Strength  | A positive whole number representing a Fleet's visible military capacity.   |
| Cloaked Strength  | A positive whole number representing a Fleet's hidden military capacity.    |
| Total Strength    | A positive whole number representing a Fleet's total military capacity.     |
| Cloaking Duration | The period for which a Fleet's Strength remains Cloaked.                    |

## Rules

A Fleet has a positive Strength, an owning Player, and an origin Planet that represents its current position until movement is implemented. Fleet Strength has no maximum in the current model.

The Standard Ruleset provides Standard, Improved, and Exceptional Build Fleet Actions. Each Action targets a Planet and creates a stationary Fleet during the Fleet Build Phase. Building on a Planet where the same Player already has a Fleet merges the new Strength into that Fleet. Different Players receive separate Fleets at the same Planet.

This slice does not validate Planet ownership. All Planets are valid build targets until ownership is implemented.

To move a Fleet, the player selects a positive amount of its Strength. That Strength departs as the moving Fleet, while any remaining Strength stays at the origin.

Fleet movement, splitting, ownership restrictions, combat, and zero-strength deletion remain planned.

### Cloaking

Cloaking creates hidden Fleet movement and information asymmetry. Enemy players cannot see or target Cloaked Strength. When a Fleet has 0 Visible Strength, Enemy players cannot see the Fleet or know its location.

When a Cloaked Fleet merges with another Fleet, its Strength remains Cloaked in the resulting Fleet. The owning player sees both Visible Strength and Cloaked Strength; Enemy players see only Visible Strength.

Cloaked Strength participates fully in Combat. A Fleet can attack or defend while Cloaked, but all its Cloaked Strength becomes Visible if it is involved in Combat. Cloaked Strength otherwise remains Cloaked for its Cloaking Duration.

## Potential Flaws

A single-stat unit model may not provide enough tactical variety once fleet gameplay expands.

Cloaking may create frustrating attacks without enough detection, warning, or counterplay systems.
