# Turn Based

## Status

Accepted

## Context

Persistent universes and real time games are very fun, super addictive, but they require a very big time investment.

They also highly favor players that can invest the time, rather than strategic thinking.

On the other side, turn based games can be slow, require players to be online at the same time if coordination is required and missed turns can be devastating.

## Decision

The game will be turn based, where players have a time window to submit actions, after which turn Resolution computes the next game state and the next turn starts.

The turn length will be decided before the game starts and is fixed throughout the game.

Each turn should be playable independently. An action must not require another player to accept, acknowledge, or respond before it can function or be the optimal action to take. The time at which you play your turn should not matter either. Being first or last to play should not change anything.

Each turn should be playable in ~30 minutes or less to limit the required time investment and keep play sessions short.

A player may enter a ready state. When all players are ready, the turn resolves immediately. This speeds up games when all players are actively playing and want to have bursts of progression. Readiness is reversible and optional.

If a player fails to submit actions, the game will still advance. The turn will not be delayed. This prevents game stalls when a player drops out.

## Pros

- The game will require minimal time investment.
- Being always online will offer no benefit.
- Turn length can be reduced for faster paced games, or increased for slower pace.
- If all players are active, many turns can happen quickly.
- The game pace will be constant since there will be no delayed turns.

## Cons

- A lot of design decisions will have to be built around short playtime and no coordination needed, potentially preventing mechanics that would otherwise be fun.
- Turns don't offer a granular increment. Actions will have to be carefully balanced to allow reacting to other players while advancing enough to make observable progress.
- Missing turns can imbalance the game since the game will move on without waiting.
