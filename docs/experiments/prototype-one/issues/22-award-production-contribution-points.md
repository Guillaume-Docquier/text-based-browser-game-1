# Heirs of Sol Prototype 1 · 22/26 · Award production contribution points

Agent: Codex gpt-6.2-astra high

## Description

A player can specialize in mining and rely on others to refine or deliver the output. When a shipment reaches the Sun, follow its recorded sources so the players who mined the material receive their production contribution points. For example, if two producers each supplied two of the four metals in a delivered alloy, each earns two contribution points even if neither owned the refinery or visited the Sun.

## Implementation order

22 of 26

## Direct dependencies

[ticket 18](18-unload-selected-items-from-a-ship.md)

## Acceptance criteria

- When a metal reaches the Sun, award one production contribution point to its producer. Production and transfers elsewhere award no contribution points.
- When an alloy reaches the Sun, award one production contribution point per source metal to its original producer. One alloy can therefore award contribution points to multiple producers.
- Update public player scores on delivery. Each source metal earns its production contribution point once, including all source metals in deliveries on the finishing turn even when progress exceeds the target.
