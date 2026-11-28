# Heirs of Sol Prototype 1 · 03a · Open planets in a full planet view

Agent: Codex gpt-6.2-astra high

## Description

Give a selected planet its own full view in the play area. Players will spend time inspecting and using individual surface hexes. The current side panel leaves little room for that surface alongside the planet’s information. Ship the full view first with the planet data already available, so [ticket 04](04-persist-buildings-and-display-them-on-stable-planet-hexes.md) can add the building surface directly to it.

## Implementation order

03a, after [prototype planet attributes](03-generate-planetary-metal-deposits.md) and before [ticket 04](04-persist-buildings-and-display-them-on-stable-planet-hexes.md).

## Direct dependencies

[ticket 03, prototype planet attributes](03-generate-planetary-metal-deposits.md).

## Acceptance criteria

- Clicking a planet on the system map opens a dedicated full planet view in the main play area. Selecting the same planet through the planet list opens the same view. Replace the existing planet details side panel at these entry points.
- Identify the planet by name and coordinates. Present its available information, including ownership, biome, size, area, metal production, and remaining deposit, with room for the hex surface that [ticket 04](04-persist-buildings-and-display-them-on-stable-planet-hexes.md) supplies.
- Reloading the planet view reopens the same game and planet. The player can return to the containing star system.
