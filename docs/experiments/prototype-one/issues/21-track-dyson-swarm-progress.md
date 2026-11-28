# Heirs of Sol Prototype 1 · 21/26 · Track Dyson swarm progress

Agent: Codex gpt-6.2-astra high

## Description

The Dyson swarm is the shared objective that connects otherwise independent colonies and trips. A player deciding whether to refine another batch or deliver immediately needs to see how much material the match still requires. Count deliveries as they enter the public Sun stockpile and show the same progress and target to everyone. Scaling that target by player count also gives a solo match a meaningful objective.

## Implementation order

21 of 26

## Direct dependencies

[ticket 18](18-unload-selected-items-from-a-ship.md)

## Acceptance criteria

- Show one public Dyson swarm at the Sun with a completion target scaled to the match’s player count, including a solo match.
- When the ordinary unload action places items in the Sun’s stockpile, increase shared progress once per item. Raw metal adds one. Alloy adds six when alloys are available.
- Count every valid delivery in the turn, including all deliveries on the finishing turn. Progress may exceed the target. For example, 8 progress delivered at 98 of 100 gives a public final total of 106. All players see the updated progress and target when delivery resolves. Delivered items remain independently inspectable.

## Design detail to settle

Tune the target by player count. Raw-metal delivery can demonstrate this system before refining is available.
