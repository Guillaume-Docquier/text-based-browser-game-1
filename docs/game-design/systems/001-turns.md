# Turns

## Status

Partially Implemented

Turn timing, lifecycle, Action locking, public reversible Readiness, and the Pay Costs, Fleet Movement, Fleet Build, normal Fleet Combat, Income, and Victory effect resolvers are implemented. Shared movement eligibility, partial Strength departures, automatic continuation, and Action-instance binding during transit are also implemented. Arrival Assaults retain their initiating Movement Tick through friendly merges and use deterministic ordering for ties. Planet Development, Surprise Assault, and Colonization remain planned. The current Victory effect is a placeholder, not the planned bounded game length or Legacy win condition.

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
- [System 010-fleets](./010-fleets.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept           | Definition                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Turn              | The period during which players can submit and revise Actions.                                                  |
| Turn Resolution   | The internal processing period that begins when a Turn ends and produces the next game state.                   |
| Phase             | A coarse, ordered stage of Turn Resolution that determines when a category of Effects resolves.                 |
| Tick              | An ordered precision sub-step inside the Fleet Movement Phase, used to sequence movement progress and arrivals. |
| Readiness         | A public state a player can set. When all players are Ready, the Turn ends. The UI presents Ready as Locked in. |
| Action Submission | A player's proposed use of an Available Action Instance, locked for processing when the Turn ends.              |
| Turn Status       | The lifecycle of one Turn: collecting actions, awaiting processing, processing, or completed.                   |

## Rules

Turns have a constant and fixed duration determined before the game starts. The default is 1 day per Turn.

At every moment, all players know how much time is left before the Turn ends. During a Turn, players can submit and revise Actions. All players play simultaneously, and their submitted Actions remain secret until resolution.

During a Turn, players can declare themselves Ready. This is public information. The UI labels this action Lock in and presents the resulting Ready state as Locked in. Cancel clears Readiness while the Turn is still collecting Actions. When all players are Ready, the Turn ends. This is the only way that a Turn can take less time than the Turn duration determined before the game starts.

When a Turn ends, its status changes from `COLLECTING_ACTIONS` to `AWAITING_PROCESSING` and all Action Submissions are locked in. Players cannot submit or revise them during Turn Resolution. The server claims the Turn with a processing queue row, changes it to `PROCESSING`, validates locked submissions, and the [System 015-rules-engine](./015-rules-engine.md) resolves the turn.

Turn Resolution processes Effects through the fixed, engine-owned Phase order: Pay Costs, Fleet Movement, Fleet Build, Fleet Combat, Planet, Colonization, Income, then Victory. A Ruleset does not configure this sequence. Phases are coarse ordering boundaries and do not create additional player Turns or opportunities to react.

The Fleet Movement Phase uses a 20-Tick scale for arrival timing. Existing journeys and new departures each advance once in the Phase, and all arrivals settle before later Phases. Ordinary landing and friendly merging use calculated arrival Tick and stable Fleet ID. Composed Move+Assault Actions capture their Assault intent while moving; the Combat Phase uses the initiating arrival Tick even if the moving Fleet merges into a friendly survivor. Fleet Combat, Colonization, and other Phases do not each run through those 20 Ticks.

After the Fleet Movement Phase, Fleet Build creates or reinforces a player's Fleet at its target Planet. Fleet Combat then resolves captured normal Assaults against the final Fleet positions. A moving Fleet is not present at its recorded origin while in transit. The Planet Phase occurs before the still-planned Colonization phase. Any future arrival-dependent Planet or Colonization rules will observe the Fleet positions established before those phases.

If a locked Action Submission is invalid or an Effect fails to resolve, Turn Resolution does not complete. The Turn remains locked and is retried from the same pre-resolution state, Action Submissions, and deterministic random input. Partial state changes and Effect Outcomes from the failed attempt are discarded.

An In-Transit Fleet advances once per resolved Turn without a new submission or another payment. Its original Action Instance remains occupied until the journey arrives; the next Turn exposes that instance as In Progress while other pool entries remain usable. Continuation outcomes are returned with the current resolution result and are not persisted as resolved-action history.

When Turn Resolution completes, the Turn becomes `COMPLETED`. If the game continues, the server creates the next `COLLECTING_ACTIONS` Turn with its own deadline, random-generator state, available Actions, and processing queue row. If the game ends, no next Turn or processing row is created.

Action submission and Turn closure lock the same Turn row. This makes the deadline check and transition to `AWAITING_PROCESSING` atomic with respect to one another.

## Potential Flaws

Because Turns are coarse-grained, in some cases a player might not have the time to react to what their opponents are doing.
