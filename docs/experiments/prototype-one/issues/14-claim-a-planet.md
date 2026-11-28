# Heirs of Sol Prototype 1 · 14/26 · Claim a planet

Agent: Codex gpt-6.2-astra high

## Description

Arrival gives a player the opportunity to settle. They choose whether to spend the colony ship’s action and consume the ship to establish an owned colony there. The new command center makes the planet usable for construction on the next turn. Since players plan simultaneously, two ships can attempt to settle the same site. Only the player who gains the colony pays the cost of losing their ship.

## Implementation order

14 of 26

## Direct dependencies

[ticket 10](10-apply-fog-of-war-at-current-positions.md), [ticket 13](13-add-colony-ships.md)

## Acceptance criteria

- A colony ship stationed at an unowned planet at turn start can use its action to claim it. A ship arriving on turn N may first claim on N+1. The private preview identifies the ship and planet.
- On success, consume the ship, give the planet one owner, and place one command center on its center hex. Construction becomes available on the following turn.
- For competing valid claims, choose a winner randomly without submission-time priority. Consume only the winner’s ship and leave the others stationed there. Show the resolved outcome under the vision rules.
- Until the turn starts resolving, the player can cancel a claim submitted that turn. Remove the claim preview and exclude it from any contest for the planet. The colony ship stays at the planet and can receive another order in the same turn.
