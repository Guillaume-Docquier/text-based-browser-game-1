# Heirs of Sol Prototype 1 · 15/26 · Extract metal with mines

Agent: Codex gpt-6.2-astra high

## Description

Mining turns a surveyed deposit into material that players can hand off and ultimately deliver to the Sun. A colony owner chooses how much permanent surface space to devote to extraction. Extra mines extract the same finite deposit faster. The owner can keep one mine’s output in drop-off for a local refinery and direct another mine’s output to pickup for haulers. Each mine uses its chosen pile automatically on successive turns.

## Implementation order

15 of 26

## Direct dependencies

[ticket 03](03-generate-planetary-metal-deposits.md), [ticket 07](07-construct-buildings-with-a-command-center.md), [ticket 14](14-claim-a-planet.md)

## Acceptance criteria

- The construction action can build mines. Each mine present at turn start extracts at the planet’s production rate up to the remaining deposit. Multiple mines share that finite deposit.
- Each mine has its own output setting. Default to private drop-off. The owner can switch it to public pickup or back without spending an action. The setting persists until changed and applies only to future production.
- Automatic extraction places each metal directly in the selected pile as an individual item with its producer recorded. Metal produced on turn N can first be targeted on N+1. In drop-off it can be refined, released, or loaded by the owner. In pickup it is available to visiting haulers without a separate release order. In current vision a player can inspect its producer. Outside vision, stockpile contents have no remembered state.
- Exhausted deposits stay empty and exhausted mines keep their hexes. A planet with a productive deposit claimed on turn N can receive a mine on N+1 and produce its first metal on N+2. Mines on any planet in a player’s home system or in Sol extract nothing because production and deposit are both zero ([increment 03](03-generate-planetary-metal-deposits.md)).
