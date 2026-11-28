# Heirs of Sol Prototype 1 · 03/26 · Generate planetary metal deposits

Agent: Codex gpt-6.2-astra high

## Description

A player choosing a colony site needs to answer two questions. How quickly could a mine produce here? How much metal could the planet yield before the deposit runs out? A high production rate can describe a small, quickly exhausted deposit. Generate and expose both values so scouting can reveal that trade-off. Players must look outside all home systems and Sol to find mineable metal.

## Implementation order

3 of 26

## Direct dependencies

[ticket 01](01-assign-prototype-home-worlds.md), [ticket 02](02-add-sol-to-the-generated-galaxy.md)

## Acceptance criteria

- Keep biome, size, and area. Replace the single `metal` field with `metal production` and `metal deposit`. Show both values in the planet list and inspector.
- Remove fertility, fuel, energy, and maximum population (`maxPopulation`) from the generator, planet schema, stored planet data, and API responses. Remove their columns, sort options, and inspector entries from the existing views.
- Every planet in any player’s home system and every planet in Sol has zero metal production and zero remaining metal deposit. This applies to every biome, including metallic planets. Apply the following generation rolls only outside those systems.
- Metallic planets have 75% chance to have a metal deposit. Gas planets never have a metal deposit. Other planets have a 25% chance to have a metal deposit.
- When they have a metal deposit, metallic planets roll between 10 and 20 metal deposit, other planets roll between 5 and 15 metal deposit.
- When they have a metal deposit, metallic planets roll between 2 and 4 metal production, other planets roll between 1 and 3 metal production.
