# Heirs of Sol Prototype 1 · 17/26 · Load selected items onto a ship

Agent: Codex gpt-6.2-astra high

## Description

A hauler at a colony chooses the exact items worth taking on the next trip. Two metal items can occupy the same amount of space and still have different producers and hauling histories. Loading must preserve that choice through simultaneous resolution. If two ships request one of the same items, each can still collect the other items it requested when they are available.

## Implementation order

17 of 26

## Direct dependencies

[ticket 09](09-move-a-ship-between-bodies.md), [ticket 16](16-release-stockpile-items-for-pickup.md)

## Acceptance criteria

- A ship stationed at the colony at turn start can load specific items already in an eligible pile at turn start. A visitor loads only from public pickup. The owner’s ships can load from either pile, including private drop-off. An item released, produced, or unloaded on turn N can first be loaded on N+1. Preview the selected items and occupied cargo slots privately.
- One ship action loads any number that fit. Each metal or alloy uses one slot. Check available space and item eligibility at resolution and retain each loaded item’s identity.
- Each item actually loaded adds its material’s mass to the ship’s total mass. A partial pickup adds only the items won. Loading a positive mass reduces current speed and affects the next movement preview. Canceled pickups add zero mass. A scout can carry one item, a transport up to four, and a colony ship none. Compare loading the same item on an empty scout and an empty transport. Filling the scout’s only slot sharply reduces its speed, while the heavier transport loses a much smaller fraction of its empty speed.
- Prevent a player from committing the same item to contradictory orders in the preview, including loading metal already selected for release or refining. Resolve different players’ competing requests for a pickup item randomly per item. Submission time gives no advantage, and a conflict over one item does not cancel uncontested pickups. Show the resolved cargo and piles within current vision.
- The player can cancel a load order until its planning turn starts resolving. Remove the ship’s requests for the selected items from pickup contests, clear the cargo preview, and free the ship’s action and planned cargo slots for another order that turn. Other ships’ requests remain eligible.
