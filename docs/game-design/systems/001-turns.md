# Turns

## Status

Not Implemented

## Purpose

Turns are the main element of the game loop. Their frequency dictates the pace of the game.

Supports:

- [GDDR 002-bounded-game-length](../decisions/002-bounded-game-length.md)
- [GDDR 003-turn-based](../decisions/003-turn-based.md)
- [GDDR 009-deterministic-data-driven-rules-engine](../decisions/009-deterministic-data-driven-rules-engine.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 006-trade](./006-trade.md)
- [System 007-contracts](./007-contracts.md)
- [System 012-travel](./012-travel.md)
- [System 011-combat](./011-combat.md)
- [System 008-planets](./008-planets.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept           | Definition                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Turn              | The period during which players can submit and revise Actions.                                        |
| Turn Resolution   | The internal processing period that begins when a Turn ends and produces the next game state.         |
| Phase             | A coarse, ordered stage of Turn Resolution that determines when a category of Effects resolves.       |
| Tick              | An ordered precision sub-step inside the Travel Phase, used to sequence travel progress and arrivals. |
| Readiness         | A public state a player can set. When all players are Ready, the Turn ends.                           |
| Action Submission | A player's proposed use of an Available Action Instance, locked for processing when the Turn ends.    |

## Rules

Turns have a constant and fixed duration determined before the game starts. The default is 1 day per Turn.

At every moment, all players know how much time is left before the Turn ends. During a Turn, players can submit and revise Actions. All players play simultaneously, and their submitted Actions remain secret until resolution.

During a Turn, players can declare themselves Ready. This is public information. When all players are Ready, the Turn ends. This is the only way that a Turn can take less time than the Turn duration determined before the game starts.

When a Turn ends, all Action Submissions are locked in and Turn Resolution begins. Players cannot submit or revise them during Turn Resolution. The server validates locked submissions and the [System 015-rules-engine](./015-rules-engine.md) turns their composed Mechanics into Effects.

Turn Resolution processes Effects through ordered Phases. Phases are coarse ordering boundaries such as Pay Costs, Travel, Combat, and Colonization; the engine defines their fixed order. They do not create additional player Turns or opportunities to react.

The Travel Phase uses 20 Ticks to provide finer chronological ordering within the Phase. Travel Ticks establish Fleet progress and arrival order, and events assigned to the same Tick are simultaneous. Combat, Colonization, and other Phases do not each run through those 20 Ticks.

After the Travel Phase, Combat resolves from the final Fleet positions. Colonization resolves in its later Phase using the arrival order established by Travel Ticks. Other engine-defined Phases may occur between Combat and Colonization. A Fleet that arrives during the Turn is present for Combat at its destination before it can colonize that Planet.

When Turn Resolution completes, its resulting game state becomes the state from which players take their Actions in the next Turn.

## Potential Flaws

Because Turns are coarse-grained, in some cases a player might not have the time to react to what their opponents are doing.
