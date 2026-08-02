# Legacy

## Status

Not Implemented

## Purpose

Legacy is the goal of the game. Empires fight to have lasting impact on the galaxy, which gives them Legacy points.

Supports:

- [GDDR 002-bounded-game-length](../decisions/002-bounded-game-length.md)
- [GDDR 004-legacy-as-win-condition](../decisions/004-legacy-as-win-condition.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 007-contracts](./007-contracts.md)

## Core Concepts

| Concept        | Definition                                                     |
| -------------- | -------------------------------------------------------------- |
| Legacy         | Impact an Empire has had on the galaxy.                        |
| Legacy Points  | The score players amass during the game that decides who wins. |
| Legacy Events  | Achievement-like way to gain Legacy Points.                    |
| Legacy Project | Hard undertakings that are the main way to gain Legacy Points. |

## Rules

Legacy Points are gained throughout the whole game and determine the winner at the end of the game. This is public information during the game.

### Legacy Events

Certain key events are triggered when players achieve milestones during the game. For example, the first player to unlock technology X or colonize Y planets, etc.

This emulates remarkable achievements that civilizations have made that were remembered through the ages. This is part of their Legacy.

The Legacy Events provide incentives to player to pursue certain goals. Maybe you want to race another player to a milestone to deny them the points, or maybe you want to spec differently from all other players to grab free milestones.

Legacy Events yield less points than Legacy Projects, but also require fewer investments. They will usually act as tiebreakers, but in some games they could be the main source of points if the game is harsh and players can't achieve Legacy Projects.

Legacy Events grant a fixed amount of points when the milestone is achieved.

| Legacy Event | Requirement                                         | Points |
| ------------ | --------------------------------------------------- | ------ |
| Space Race   | Be the first to colonize a planet                   | 1      |
| Annihilation | Be the first to exterminate another player's planet | 5      |
| Fertility    | Be the first to grow a planet to 10B population     | 10     |
| ...          | ...                                                 | ...    |

Note: These are examples for now, the exact set of events and their points will have to be refined and balanced.

### Legacy Projects

Players will be able to realize Legacy Projects. These will be expensive and game changing projects, but will reward way more Legacy Points.

Every Legacy project will add a mechanic for all players, altering the course of the game.

These projects will be big, often times requiring, and rewarding, multiple players.

There will always be a Legacy Project sponsor and zero or more contributors. The sponsor and contributors will all score points, to the extent of their contributions. The sponsor will be required to contribute up front to kick off the project, and all players will be able to complete contracts for the project.

| Legacy Project   | New Mechanic                                                               | Points                                   |
| ---------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| Dyson Sphere     | Energy is free and infinite                                                | 200                                      |
| Science Archives | Players can share technologies with the galaxy                             | 50 + X per shared tech based on its tier |
| Closed Borders   | Empires have defined borders. Players gain full vision in their territory  | 75                                       |
| Imperium Coin    | Every Empire gains 1000 coins and can now trade using this common currency | 1% of all coins traded during the game   |
| ...              | ...                                                                        | ...                                      |

Note: These are examples for now, the exact set of events and their points will have to be refined and balanced.

## Potential Flaws

Legacy Events and Projects alone might not feel like doing things other than legacy projects and racing for events matters, but it should. Players should always feel that the actions they take will eventually lead to a potential win. Having ongoing scoring (as opposed to one time fixed points per achievements) might solve this, but we probably need scoring outside of Legacy Events and Projects otherwise they become way too OP. Maybe everything gives small amounts of points, and Legacy Projects top it off.
