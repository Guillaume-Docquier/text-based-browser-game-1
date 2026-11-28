# Heirs of Sol Prototype 1 · 12a · Add scout ships

Agent: Codex gpt-6.2-astra high

## Description

A player can build a scout at a shipyard and send it to survey potential colony sites. The scout is light and fast when empty. Its advantage is how far it travels in a turn. Its scan radius is 1.5 light-years (LY), the same as every other ship’s. A player weighing up a scouting trip can inspect the scout’s capabilities and preview how long it will take to reach the destination.

## Implementation order

12a, after [shipyards](12-build-ships-at-shipyards.md) and before [colony ships](13-add-colony-ships.md).

## Direct dependencies

[ticket 11, surveying a route](11-survey-planets-along-a-ships-route.md) and [ticket 12, building ships at shipyards](12-build-ships-at-shipyards.md).

## Acceptance criteria

- An owned shipyard offers the scout as a distinct ship type. The usual build preview, price, cancellation, and turn resolution apply. The completed scout is stationed at that yard’s planet.
- Give the scout exactly one cargo slot and tune its thrust and low empty mass for fast empty speed. Calculate current speed with `speed = k × √(thrust / total mass)`, using the shared scale k. Total mass includes the scout’s empty mass and all cargo aboard.
- Loading the scout’s one slot sharply reduces speed. For the same item, the percentage loss from empty speed is much greater on the scout than on the heavier, higher-thrust transport. Unloading restores the scout’s fast empty speed.
- The owner can select the scout, preview a trip, and send it using either movement entry point. Apply the existing scan coverage and survey the segment it actually travels each turn.
- Each player still starts with a transport. Scouts become available through shipbuilding.

## Tuning

Tune the scout’s build price, thrust, and empty mass to achieve its fast empty speed and strong slowdown under load.
