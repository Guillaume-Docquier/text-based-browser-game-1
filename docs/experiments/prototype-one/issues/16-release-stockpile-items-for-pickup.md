# Heirs of Sol Prototype 1 · 16/26 · Release stockpile items for pickup

Agent: Codex gpt-6.2-astra high

## Description

A producer needs a way to offer some output to passing haulers while keeping the rest for local use. For example, the owner can release one metal for collection and keep four others available for a refinery. Metal a mine sends directly to pickup is available to haulers on the following turn. The owner can also release selected items that are already in drop-off. Releasing selected items from private drop-off to public pickup makes cooperation possible without a separate trade action.

## Implementation order

16 of 26

## Direct dependencies

[ticket 15](15-extract-metal-with-mines.md)

## Acceptance criteria

- Only the planet owner can transfer items directly between piles. Select specific items from private drop-off at turn start for release to public pickup. The transfer goes one way. The private preview prevents selecting an item already committed to another order.
- Resolution moves only the selected items and preserves their identities and contributors. Anyone in scan range can inspect both piles and the items’ contributor histories. An item released on turn N can first be loaded from pickup on N+1.
- Apply stockpile visibility consistently to every view. Other players cannot see the owner’s planned release.
- The owner can cancel a pending release until its planning turn starts resolving. Clear that transfer’s preview. Its items stay in their source pile unless moved by another order, and the owner can submit a different selection in the same turn.
