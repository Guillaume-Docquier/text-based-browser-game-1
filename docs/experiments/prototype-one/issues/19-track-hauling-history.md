# Heirs of Sol Prototype 1 · 19/26 · Track hauling history

Agent: Codex gpt-6.2-astra high

## Description

A shipment can change ships or travel through several colonies before reaching the Sun. The final carrier alone cannot tell players who moved it or how far. Keep the hauler and actual distance traveled with each item so a player inspecting the cargo can trace those legs. This history supplies the evidence for dividing transport contribution points on delivery, including when several metals become one alloy.

## Implementation order

19 of 26

## Direct dependencies

[ticket 09](09-move-a-ship-between-bodies.md), [ticket 17](17-load-selected-items-onto-a-ship.md)

## Acceptance criteria

- When a ship travels X LY, add X LY to the history of each individual item aboard and attribute it to the ship’s owner. For example, four metals carried together for 1 LY each record 1 LY for that hauler. Count detours and repeated legs.
- A player who can see an item can inspect the contribution history, including successive haulers. Transfers preserve that history.
- Record actual LY for each item, whatever else the ship carries. Once refining is available, an alloy carried 2 LY records 2 LY in its own history. Its component metals retain exactly the histories they had at refinement. Transport scoring applies the component multiplier when the alloy reaches the Sun.
