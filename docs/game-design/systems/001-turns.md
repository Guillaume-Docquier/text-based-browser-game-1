# Turns

## Status

Partially Implemented

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
- [System 012-movement](012-movement.md)
- [System 011-combat](./011-combat.md)
- [System 008-planets](./008-planets.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Implementation Progress

- [x] Scheduled Turn windows and Turn Resolution
- [x] Public, reversible Readiness and early Turn Resolution
- [ ] Automatic retry after failed Turn Resolution

## Core Concepts

| Concept           | Definition                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Turn              | The period during which players can submit and revise Actions.                                            |
| Turn Resolution   | The internal processing period that begins when a Turn ends and produces the next game state.             |
| Phase             | A coarse, ordered stage of Turn Resolution that determines when a category of Effects resolves.           |
| Tick              | An ordered precision sub-step inside the Movement Phase, used to sequence movement progress and arrivals. |
| Readiness         | A public state a player can set. When all players are Ready, the Turn ends.                               |
| Action Submission | A player's proposed use of an Available Action Instance, locked for processing when the Turn ends.        |
| Turn Status       | The lifecycle of one Turn: collecting actions, awaiting processing, processing, or completed.             |

## Rules

Turns have a constant and fixed duration determined before the game starts. The default is 1 day per Turn.

At every moment, all players know how much time is left before the Turn ends. During a Turn, players can submit and revise Actions. All players play simultaneously, and their submitted Actions remain secret until resolution.

During a Turn, players can declare themselves Ready. This is public information. When all players are Ready, the Turn ends. This is the only way that a Turn can take less time than the Turn duration determined before the game starts.

When a Turn ends, its status changes from `COLLECTING_ACTIONS` to `AWAITING_PROCESSING` and all Action Submissions are locked in. Players cannot submit or revise them during Turn Resolution. The server claims the Turn with a processing queue row, changes it to `PROCESSING`, validates locked submissions, and the [System 015-rules-engine](./015-rules-engine.md) turns their composed Mechanics into Effects.

Turn Resolution processes Effects through the fixed, engine-owned Phase order: Pay Costs, Movement, Combat, Planet, Colonization, Income, then Victory. A Ruleset does not configure this sequence. Phases are coarse ordering boundaries and do not create additional player Turns or opportunities to react.

The Movement Phase uses 20 Ticks to provide finer chronological ordering within the Phase. Movement Ticks establish Fleet progress and arrival order, and events assigned to the same Tick are simultaneous. Combat, Colonization, and other Phases do not each run through those 20 Ticks.

After the Movement Phase, Combat resolves from the final Fleet positions. The Planet Phase occurs before Colonization. Colonization then uses the arrival order established by Movement Ticks. A Fleet that arrives during the Turn is present for Combat at its destination before it can colonize that Planet.

If a locked Action Submission is invalid or an Effect fails to resolve, Turn Resolution does not complete. The Turn remains locked and is retried from the same pre-resolution state, Action Submissions, and deterministic random input. Partial state changes and Effect Outcomes from the failed attempt are discarded.

When Turn Resolution completes, the Turn becomes `COMPLETED`. If the game continues, the server creates the next `COLLECTING_ACTIONS` Turn with its own deadline, random-generator state, available Actions, and processing queue row. If the game ends, no next Turn or processing row is created.

Action submission and Turn closure lock the same Turn row. This makes the deadline check and transition to `AWAITING_PROCESSING` atomic with respect to one another.

## Potential Flaws

Because Turns are coarse-grained, in some cases a player might not have the time to react to what their opponents are doing.
