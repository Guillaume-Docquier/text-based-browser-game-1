# Combat

## Purpose

Combat resolves fleet assaults quickly and predictably while preserving a meaningful advantage for Surprise Assault.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 010-fleets](./010-fleets.md)

## Core Concepts

| Concept          | Definition                                                             |
| ---------------- | ---------------------------------------------------------------------- |
| Assault          | An arriving Fleet attacks all Enemy Fleets at its destination.         |
| Combined force   | All Fleets on one side of a combat treated as one total Strength.      |
| Surprise Assault | An Assault where the attacker deals damage before defenders retaliate. |

## Rules

When a Fleet assaults a Planet, it fights all Enemy Fleets at that Planet as one combined defending force.

In normal combat, each side loses Strength equal to the other side's total Strength, capped at its own total Strength.

If a side contains multiple Fleets, its total Strength loss is distributed proportionally across those Fleets. Losses use whole numbers. Rounding may be required, but total losses must be respected.

Surprise Assault resolves in two steps. First, the attacking Fleet deals its Strength as loss to the combined defending force. Then only surviving defending Strength deals loss to the attacker. If no defending Strength remains, there is no retaliation.

## Potential Flaws

The exact proportional rounding rule remains open and must be deterministic once implemented.
