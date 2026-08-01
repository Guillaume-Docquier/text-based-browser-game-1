# Combat

## Purpose

Combat resolves hostile fleet encounters quickly and predictably while preserving a meaningful advantage for Surprise Assault.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 010-fleets](./010-fleets.md)
- [System 001-turns](./001-turns.md)
- [System 013-cloaking](./013-cloaking.md)

## Core Concepts

| Concept          | Definition                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Assault          | A combat in which an attacking Fleet fights all Enemy Fleets at a destination Planet.     |
| Combined Force   | The total Strength of all Fleets on one side of a combat.                                 |
| Surprise Assault | An Assault in which the attacking side deals damage before the defending side retaliates. |

## Rules

Combat resolves after all Travel and arrival-dependent events have completed for Turn Resolution. It uses the final Fleet positions, so every Fleet that arrived during the Turn is present before combat begins.

An Assault at a Planet has an attacking Fleet and a defending side made up of all Enemy Fleets at that Planet. Each side's Strength is its Combined Force.

In normal combat, each side loses Strength equal to the other side's Combined Force, capped at its own Combined Force.

If a side contains multiple Fleets, its total Strength loss is distributed proportionally across those Fleets. Losses use whole numbers. Rounding may be required, but total losses must be respected.

A Surprise Assault resolves in two steps. First, the attacking Fleet deals its Strength as loss to the Combined defending force. Then only surviving defending Strength deals loss to the attacker. If no defending Strength remains, there is no retaliation.

## Potential Flaws

The exact proportional rounding rule remains open and must be deterministic once implemented.
