# Turn Based

## Status

Partially implemented

- [x] Turns
- [ ] Readiness

## Context

Persistent universes and real time games are very fun, super addictive, but they require a very big time investment.

They also highly favor players that can invest the time, rather than strategic thinking.

On the other side, turn based games can be slow, require players to be online at the same time if coordination is required and missed turns can be devastating.

## Decision

The game will be turn based, where players have a time window to submit orders, after which the turn is resolved, the next game state is computed, and the next turn starts.

The turn length will be decided before the game starts and can vary between games.

Each turn should be playable independently. An action must not require another player to accept, acknowledge, or respond before it can function or be the optimal action to take.

Each turn should be playable in ~30 minutes or less to limit the required time investment.

A player may enter a ready state. When all players are ready, the turn resolves immediately. Readiness is reversible.

The game will be leaning towards auto-battler style, where a simulation advances the game without your input. This will soften the impact of missed turns.

If a player fails to submit orders, the game will still advance. The turn will not be delayed.

## Pros

- The game will require minimal time investment.
- Being always online will offer a marginal benefit.
- Turn length can be reduced for faster paced games, or increased for slower pace.
- If all players are active, many turns can happen quickly.
- The game pace will be constant since there will be no delayed turns.
- Missing a turn won't be the end of the world, but not optimal.

## Cons

- A lot of design decisions will have to be built around short playtime and no coordination needed, potentially preventing mechanics that would otherwise be fun.
- Turns don't offer a granular increment. Actions will have to be carefully balanced to allow reacting to other players while advancing enough to make observable progress.
