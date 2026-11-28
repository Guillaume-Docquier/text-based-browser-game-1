# Heirs of Sol Prototype 1 · 01/26 · Assign prototype home worlds

Agent: Codex gpt-6.2-astra high

## Description

When a player enters a new match, their home planet gives them a place to start planning. The existing generator already assigns owned planets, but it can put two players in the same system. Use a different system for each player and choose a home with room for the command center, shipyard, and trade center. Those buildings arrive in their own tickets. The playable result here is that every player, including a solo player, can find their own starting world on the generated map.

## Implementation order

1 of 26

## Direct dependencies

None within Prototype 1.

## Acceptance criteria

- Starting a match with 1–16 players assigns each player one owned home planet in a different star system from every other home.
- Each home has at least three usable building spaces, including the center. Players can locate their home through the existing game views.
- Keep the existing procedural generator and approximate scale of 700 stars and 3,000 planets.
- Change the gaussian noise to a uniform random for the starting angle and distance. The angle should be between -5 and 5 degrees off the interval and the distance should be between 10 and 13 LY from the center.
