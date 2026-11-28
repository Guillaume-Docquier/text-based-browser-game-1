# Heirs of Sol Prototype 1 · 24/26 · Award refining contribution points

Agent: Codex gpt-6.2-astra high

## Description

Running a refinery is a contribution in its own right. A player can process another player’s metal, release the alloy, and rely on a third player to deliver it. Use the refinery owner recorded on that alloy to award the refining contribution points when it reaches the Sun. This lets a player specialize in refining even if they own neither mines nor delivery ships.

## Implementation order

24 of 26

## Direct dependencies

[ticket 18](18-unload-selected-items-from-a-ship.md), [ticket 20](20-refine-metal-into-alloy.md)

## Acceptance criteria

- Delivering an alloy to the Sun awards exactly two refining contribution points to its refinery owner, including when another player delivers it. Every alloy delivered on the finishing turn earns its two refining contribution points, even when the swarm exceeds its target.
- Refining an item, handing it off at a colony, and delivering raw metal award zero refining contribution points.
- Update the public score when delivery resolves and preserve the item’s inspectable refinery attribution.
