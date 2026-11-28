# Heirs of Sol Prototype 1 · 04/26 · Persist buildings and display them on stable planet hexes

Agent: Codex gpt-6.2-astra high

## Description

Establish the buildings system for Prototype 1. Save each building in the database with its type, planet, and occupied hex. A player opening their home planet sees the command center in the center and can identify the surrounding sites that will be available for construction. Later tickets use the same building records, hex positions, and type-to-art mapping when they introduce more buildings or let the player build them.

## Implementation order

4 of 26, after the full planet view in [step 03a](03a-open-planets-in-a-full-planet-view.md).

## Direct dependencies

[ticket 01, home worlds](01-assign-prototype-home-worlds.md) and [ticket 03a, full planet view](03a-open-planets-in-a-full-planet-view.md).

## Acceptance criteria

- **Database persistence.** Persist each building instance with its identity, building type, planet, and stable hex position. Create the starting command center in the database when the match starts. Reading the planet in a fresh session or after a backend restart returns the same building at the same hex.
- **Placement.** Each home planet starts with exactly one command center on the center hex. Unowned planets start with empty surfaces. Each hex holds at most one building. The command center occupies one normal hex and is unique on its planet.
- **Surface layout.** Display exactly as many usable hexes as the planet’s area. Place the center first, then add adjacent hexes in concentric hexagonal rings. Fill the nearest ring before starting the next. Use a fixed starting direction and traversal order for every ring, including a partially filled outer ring.
- **Stable positions.** Each hex has a stable position relative to the center. Reloading the page, leaving and reopening the planet, or reading the buildings in a different order produces the same arrangement of empty and occupied hexes. When a building occupies a previously empty hex, the surrounding hexes keep their positions.
- **Building types and art.** Each building kind has a distinct type with dedicated matching hex art. Instances of the same type use the same art. Deliver the command center type and its artwork in this ticket. Each later building ticket supplies its type and matching art when it introduces that building.
- **Full planet view.** Render the persisted surface on the dedicated planet view from [increment 03a](03a-open-planets-in-a-full-planet-view.md). The player can distinguish the command center from empty sites and inspect the surface alongside the planet information.
