# Bounded Game Length

## Status

Planned

- [ ] Bounded game length
- [ ] Hard win conditions

## Context

Each game should be guaranteed to end and should not be too long. Very long games, or infinite universes, tend to die out with the player base.

After a while, some players become clearly stronger or progress grinds to a halt, and the game stops being engaging.

At the same time, the game needs to give players enough time to invest in and develop an empire.

## Decision

Every game has a fixed duration that players know before it starts. A winner is declared when the deadline is reached.

A predefined public hard-win achievement may end the game earlier. Its requirements must be sufficiently difficult and conclusive that completing it clearly establishes one empire as the winner. The game ends immediately when that achievement resolves.

This is to prevent dragging games that are clearly won.

## Pros

- Players know what to expect of the game in terms of time investment.
- The length of the game also becomes strategic information, as the remaining game time can change players choices. A long term investment is better at the start of the game than near the end.

## Cons

- Hard wins will have to be balanced carefully to achieve their intended goal
