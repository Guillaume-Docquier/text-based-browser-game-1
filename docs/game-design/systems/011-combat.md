# Combat

## Status

Partially Implemented

Normal Assaults are implemented. Surprise Assault remains planned.

## Purpose

Combat resolves hostile fleet encounters quickly and predictably while preserving a meaningful advantage for Surprise Assault.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 010-fleets](./010-fleets.md)
- [System 001-turns](./001-turns.md)
- [System 008-planets](./008-planets.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept          | Definition                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Assault          | A combat in which an attacking Fleet fights all Enemy Fleets at a destination Planet.     |
| Combined Force   | The total Strength of all Fleets on one side of a combat.                                 |
| Surprise Assault | An Assault in which the attacking side deals damage before the defending side retaliates. |

## Rules

The Fleet Combat Phase resolves after Fleet Movement has advanced every journey and settled every arrival, and after Fleet Build. An Assault sees all Fleets stationed at its destination, including arrivals and Build contributions from the current Turn. A Fleet still in transit is not present at its recorded origin. If an arriving friendly Fleet merges, its Assault remains bound to that initiating order and is retargeted to the actual surviving Fleet, whose ID and name are preserved.

An Assault at a Planet has one attacking Fleet and a defending side made up of every stationary Enemy Fleet at that Planet, including Fleets owned by different players. A standalone Assault requires the owned source Fleet to be stationed at the target Planet. Move+Assault captures the Assault definition during departure and resolves it on arrival; the original source remainder does not attack from its origin.

Normal Assault makes one simultaneous exchange. With attacker Strength A and combined defender Strength D, the attacker loses min(A, D), and the defenders lose min(D, A). A successful Assault with no defenders is a Resolved no-op. If an earlier Assault destroys an attacker before its queued turn, that later Assault is Prevented. Each later Assault uses the surviving forces left by earlier ones.

When defender losses are distributed across multiple Fleets, each Fleet receives its proportional whole-number share. Remaining units go by largest fractional remainder, with Fleet ID as the stable tie-breaker, so the total loss is exact and no Fleet becomes negative.

Assaults resolve by their initiating movement Tick. The exact replay keys, ordinal comparison, seeded tie shuffle, and prevented queued-order behavior are defined in [Turn Resolution determinism](../../architecture/turn-resolution.md#determinism). Surprise Assault, first strike, cloaking, conquest, and ownership change remain planned.

## Potential Flaws

Surprise Assault remains unimplemented; the future first-strike rules still need their own balance and player-facing explanation.
