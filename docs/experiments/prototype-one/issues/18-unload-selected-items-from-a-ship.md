# Heirs of Sol Prototype 1 · 18/26 · Unload selected items from a ship

Agent: Codex gpt-6.2-astra high

## Description

Unloading determines the next use of a shipment. A hauler can leave metal at another player’s colony for refining or keep it aboard until reaching the Sun. Use the same item-selection and unload action at both destinations. The receiving stockpile determines what happens next. Material at a colony can re-enter circulation, while a delivery to the Sun stays there as a public record.

## Implementation order

18 of 26

## Direct dependencies

[ticket 02](02-add-sol-to-the-generated-galaxy.md), [ticket 17](17-load-selected-items-onto-a-ship.md)

## Acceptance criteria

- A ship stationed at the destination at turn start can privately preview and unload selected items already aboard. Visitors unload only into private drop-off. The planet owner’s ships can unload into private drop-off or directly into public pickup. Items unloaded on turn N can first be targeted at the colony on N+1.
- Use the same unload action at the Sun. Its single public drop-off pile keeps every delivered item individually inspectable and permanently ineligible for pickup.
- Subtract the mass of the items actually unloaded at a colony or the Sun. Use the resulting mass for the next move. A partially unloaded ship speeds up, and a fully unloaded ship regains its empty speed. A canceled unload keeps the current load and speed.
- Preserve item identities and contributors. Unloading, loading a return cargo, and departing require three separate turns for one ship. Show the resolved cargo and destination pile.
- The player can cancel an unload order at a colony or the Sun until its planning turn starts resolving. Clear the preview and free the ship for another order that turn. The selected items stay aboard. A canceled Sun delivery adds no swarm progress or contribution points.
