# Resources

## Status

Not Implemented

## Purpose

Resources are the distinct economic inputs and outputs that make empire development, specialization, and exchange meaningful.

Supports:

- [GDDR 008-thematic-resources](../decisions/008-thematic-resources.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 008-planets](./008-planets.md)
- [System 005-political-regime](./005-political-regime.md)
- [System 006-trade](./006-trade.md)
- [System 007-contracts](./007-contracts.md)

## Core Concepts

| Concept               | Definition                                                                              |
| --------------------- | --------------------------------------------------------------------------------------- |
| Resource              | A named, thematic economic good that an empire can acquire, hold, and spend.            |
| Resource Stockpile    | The quantity of one Resource currently held by an empire.                               |
| Resource Production   | The process that adds a Resource to an empire's Stockpile.                              |
| Resource Cost         | The quantity of a Resource removed from an empire's Stockpile to pay for a game effect. |
| Resource Availability | The degree to which an empire can produce or obtain a Resource from its own territory.  |

## Resource Catalogue

| Resource  | Current role                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| Influence | The resource required to play every Action. Each Turn, it resets to the fixed amount set by Political Regime. |
| Metal     | Supports construction, including Fleets and Infrastructure.                                                   |
| Fuel      | Supports Fleet movement.                                                                                      |
| Energy    | Represents coordination effort, time investment and actions that grant buffs or additional effects.           |
| Colony    | Supports colonizing additional Planets. It is fractional and produced in low amounts.                         |

## Rules

The game uses multiple distinct Resources. Metal, Fuel, Energy, Influence, and Colony are the current catalogue; additional Resources may be added later.

Each Resource has its own production methods, uses, and availability. Planet attributes and Ideological Alignment can make a Resource abundant, limited, or unavailable from an empire's own territory.

An empire may hold and spend a Resource it has acquired regardless of its current Ideological Alignment. Alignment can restrict resource production and Action availability, but does not restrict ownership. Resources may therefore be stockpiled for a future Alignment change or exchanged with other empires where the relevant system permits it.

Individual Resources may have additional rules that define their sources, costs, storage, transferability, or interactions with other systems.

## Potential Flaws

A large or poorly differentiated resource catalogue can create bookkeeping without meaningful strategic choices. Resource sources, uses, scarcity, and alignment relationships must be clear enough for players to make informed decisions.
