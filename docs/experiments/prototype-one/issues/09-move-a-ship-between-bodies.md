# Heirs of Sol Prototype 1 · 09/26 · Move a ship between bodies

Agent: Codex gpt-6.2-astra high

## Description

Travel commits a specific ship and some of the player’s credits, potentially for several turns. A player planning from a ship should be able to enter a destination, while a player looking at a promising planet should be able to send a ship there. Both choices describe the same trip. Showing its destination, duration, and full price before departure lets the player decide whether that commitment is worthwhile.

## Implementation order

9 of 26

## Direct dependencies

[ticket 05](05-give-each-player-a-credit-balance.md), [ticket 08](08-give-each-player-a-starting-transport.md)

## Acceptance criteria

- Order a move by selecting a ship and entering destination coordinates, or by selecting a body and choosing a ship. Any star or planet is a valid destination, including across systems.
- The private preview identifies the ship, destination, travel time, and cost. Charge one credit per light-year in full when movement starts. Enforce affordability against the player’s global balance.
- Use `speed = k × √(thrust / total mass)` for every ship type, where `total mass = empty ship mass + mass of cargo aboard`. Use the same shared scale k and departure load for both order previews and turn resolution. At equal thrust, quadrupling total mass halves speed. The slower ship takes longer over the same distance before turn rounding. The credit cost still depends only on distance.
- Tune thrust and empty mass in the transport template for medium empty speed when implementing movement. The heavier transport has more thrust than the light scout. The scout’s empty speed is fast and the colony ship’s is medium. Once cargo is available, compare the scout and transport with the same single item aboard. The scout loses a much larger fraction of its empty speed because the item adds a larger fraction of its empty mass. The colony ship has zero slots and always travels empty.
- Both previews and resolution use `ceil(distance / speed)` turns. Measure distance in light-years (LY) and speed in LY per turn. Movement begins when the submitted turn resolves. A trip of 1 LY at 1 LY per turn ordered on turn N arrives at the end of N, and the ship can act at its destination on N+1. At 2 LY per turn, 4 LY takes two turns and 4.1 LY takes three.
- Give each ship one action per turn. Separate ships act independently. Advance a trip using distance and ship speed, show its progress, and leave the ship stationed at arrival. Once started, the trip cannot be changed or recalled.
- The player can cancel a move submitted from either interface until that planning turn starts resolving. Clear the route preview, leave the ship at its origin, and make the full travel cost and the ship’s action available immediately. The player can submit a different order that turn. Once the ship departs, the trip cannot be recalled.
