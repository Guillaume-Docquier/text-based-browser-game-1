# Turns

## Purpose

Turns are the main element of the game loop. Their frequency dictates the pace of the game.

Supports:

- [GDDR 002-bounded-game-length](../decisions/002-bounded-game-length.md)
- [GDDR 003-turn-based](../decisions/003-turn-based.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 012-travel](./012-travel.md)
- [System 011-combat](./011-combat.md)
- [System 008-colonization](./008-colonization.md)

## Core Concepts

| Concept         | Definition                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Turn            | The period during which players can submit and revise Actions.                                      |
| Turn Resolution | The internal processing phase that begins when a Turn ends and produces the next game state.        |
| Tick            | An ordered sub-step within Turn Resolution, used to calculate events that must resolve in sequence. |
| Readiness       | A public state a player can set. When all players are Ready, the Turn ends.                         |
| Action          | What players can do to affect the game.                                                             |

## Rules

Turns have a constant and fixed duration determined before the game starts. The default is 1 day per Turn.

At every moment, all players know how much time is left before the Turn ends. During a Turn, players can submit and revise Actions. All players play simultaneously, and their submitted Actions remain secret until resolution.

During a Turn, players can declare themselves Ready. This is public information. When all players are Ready, the Turn ends. This is the only way that a Turn can take less time than the Turn duration determined before the game starts.

When a Turn ends, all Actions are locked in and Turn Resolution begins. Players cannot submit or revise Actions during Turn Resolution.

Turn Resolution processes the locked-in Actions and automatic game events through 20 Ticks deterministically. Ticks are internal to resolution: they do not create additional player turns or opportunities to react. They establish the order for Travel and record the arrival order of Fleets. Events assigned to the same Tick are simultaneous.

Ticks are not used to resolve Combat or Colonization. After all Travel has completed, Combat resolves from the final Fleet positions. Colonization then resolves after Combat, using the arrival order established by Travel Ticks. A Fleet that arrives during the Turn is present for Combat at its destination before it can colonize that Planet.

When Turn Resolution completes, its resulting game state becomes the state from which players take their Actions in the next Turn.

## Potential Flaws

Because turns are coarse grained, in some cases a player might not have the time to react to what their opponents are doing.
