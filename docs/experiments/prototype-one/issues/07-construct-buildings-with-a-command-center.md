# Heirs of Sol Prototype 1 · 07/26 · Construct buildings with a command center

Agent: Codex gpt-6.2-astra high

## Description

The command center lets a colony owner decide what to build and which hex to commit to it. The first useful choice is a second trade center. The player spends credits and surface space now to earn more income on later turns. Use the existing trade center for this first construction order. The player should be able to tell which building already exists and which hex they have selected in their private plan.

## Implementation order

7 of 26

## Direct dependencies

[ticket 06](06-produce-income-with-trade-centers.md)

## Acceptance criteria

- At a planet owned at turn start, select a constructible building and an empty hex. The private preview shows the exact hex and credit cost. Use a second trade center as the first build.
- Each command center can construct one building at a time. Follow the existing reversible readiness flow. Other players see the resolved building only when visibility permits.
- Validate all of the player’s pending orders against the turn-start balance. The preview prevents the player from committing the same funds twice. A completed building first provides its capability on the next turn. Charge once on construction and show the completed building on its permanent hex. Command centers cannot be constructed.
- While the turn in which they submitted a construction order is open, the player can cancel it. Clear the preview, release the hex and the command center’s action, and make the full build cost available again. The player can choose another build that turn. A canceled building never enters construction.
