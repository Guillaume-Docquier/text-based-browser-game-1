# Turns

## Purpose

Turns are the main element of the game loop. Their frequency dictates the pace of the game.

Supports:

- [GDDR 002-bounded-game-length](../decisions/002-bounded-game-length.md)
- [GDDR 003-turn-based](../decisions/003-turn-based.md)

Relates to:

- [System 003-actions](./003-actions.md)

## Core Concepts

| Concept   | Definition                                                       |
| --------- | ---------------------------------------------------------------- |
| Turn      | The period of time during which players can submit Actions.      |
| Readiness | Players can be Ready. When all players are Ready, the Turn ends. |
| Action    | What players can do to affect the game.                          |

## Rules

Turns have a constant and fixed duration determined before the game starts. The default is 1 day per Turn.

At every moment, all players know how much time is left before the Turn ends.

During their Turn, players can submit Actions. They can change their Actions at any time before the Turn is over.

All players play simultaneously. They all submit secret Actions that are resolved when the Turn ends.

During their Turn, players can declare themselves as Ready. This is public information. When all players are Ready, the turn ends. This is the only way that a Turn can take less time than the Turn duration determined before the game starts.

When the Turn ends, all Actions are locked-in and processed deterministically.
