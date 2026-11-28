# Heirs of Sol Prototype 1 · 06/26 · Produce income with trade centers

Agent: Codex gpt-6.2-astra high

## Description

The starting trade center gives every player a recurring source of credits before they establish a second colony. A player should be able to inspect the building at home, resolve a turn, and see what it earned. Each additional trade center will use this same income rule, giving players a reason to spend a scarce building hex on their economy.

## Implementation order

6 of 26

## Direct dependencies

[ticket 04](04-persist-buildings-and-display-them-on-stable-planet-hexes.md), [ticket 05](05-give-each-player-a-credit-balance.md)

## Acceptance criteria

- Every home starts with a trade center on a free hex alongside the command center.
- Each trade center operating at turn start adds its income when that turn resolves. Credits earned on turn N first fund orders on turn N+1.
- A player can inspect the starting trade center and see its income reflected in the balance. Income per center is a tuning value.
