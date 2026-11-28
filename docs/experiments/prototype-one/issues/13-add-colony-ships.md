# Heirs of Sol Prototype 1 · 13/26 · Add colony ships

Agent: Codex gpt-6.2-astra high

## Description

Settling another planet starts with a decision at the shipyard. A player can keep building reusable transports or spend credits on a colony ship and send it to a chosen site. Introduce the colony ship as a build choice that uses the existing shipbuilding and movement orders. Its first playable use is to reach an unowned planet and be in position for the separate claim action.

## Implementation order

13 of 26

## Direct dependencies

[ticket 09](09-move-a-ship-between-bodies.md), [ticket 12](12-build-ships-at-shipyards.md)

## Acceptance criteria

- A player can select the colony ship at an existing shipyard, preview its credit cost, and build it through the same shipbuilding action.
- The result is an individually selectable colony ship stationed at that planet. Its owner can fly it to another body using the existing movement action and the colony ship’s speed.
- The colony ship has zero cargo slots and cannot load items. Tune thrust and empty mass for medium speed under `speed = k × √(thrust / total mass)`. It always travels at empty mass and uses the same 1.5 light-year (LY) scan radius as transports and scouts. Its build price is tunable. The colony ship is available to build alongside the transport.
- Colony ships use the existing cancellation rules for shipbuilding and movement. Canceling a pending colony ship build frees the yard and its full price. Canceling a colony ship’s planned move before turn resolution frees the ship’s action and its full travel cost.
