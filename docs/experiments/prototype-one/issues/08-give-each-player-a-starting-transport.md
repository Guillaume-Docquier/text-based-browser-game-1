# Heirs of Sol Prototype 1 · 08/26 · Give each player a starting transport

Agent: Codex gpt-6.2-astra high

## Description

The transport is the player’s first ship. Give each player a transport they can select at their home planet when the match starts. Its type refers to a shared template. Thrust and empty mass will determine how it travels, and cargo size will limit how much it can carry.

## Implementation order

8 of 26

## Direct dependencies

[ticket 01](01-assign-prototype-home-worlds.md)

## Acceptance criteria

- Each player starts with one empty transport stationed at their home planet.
- Define the transport template in memory with its ship type, thrust, empty mass, and cargo size. Set cargo size to four slots. Use provisional values for thrust and empty mass.
- Of these base properties, persist only the ship type on each ship instance. Use it to look up the shared in-memory template whenever thrust, empty mass, or cargo size is needed.
- Selecting the ship shows its owner and location, along with the type, thrust, empty mass, and cargo size from its template.
