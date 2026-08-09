# Planets

## Status

Partially Implemented

Biome, Size, and initial Planet Attributes are generated deterministically when a game starts, persisted, and visible on the Star System map. Colonization, vision memory, Terraforming, and Planet Development remain planned.

## Purpose

Planets are the places empires develop, fight over, and colonize. Their Biomes and Attributes create the local tradeoffs that shape expansion.

Supports:

- [GDDR 004-legacy-as-win-condition](../decisions/004-legacy-as-win-condition.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 012-travel](./012-travel.md)
- [System 001-turns](./001-turns.md)
- [System 014-resources](./014-resources.md)
- [System 010-fleets](./010-fleets.md)
- [System 009-infrastructure](./009-infrastructure.md)
- [System 004-ideological-alignment](./004-ideological-alignment.md)
- [System 011-combat](./011-combat.md)

## Core Concepts

| Concept              | Definition                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Planet               | A fixed location in the galaxy that may be Unclaimed or owned by an empire.                            |
| Unclaimed Planet     | A Planet with no owner that may be claimed through colonization.                                       |
| Colony               | A resource required to attempt colonization.                                                           |
| Colonization Attempt | An empire's attempt to establish ownership of an Unclaimed Planet with a Fleet that has arrived there. |
| Planet Attribute     | A statistic of a Planet that affects its capabilities and resource production.                         |
| Biome                | A Planet classification that determines ranges for resource production.                                |
| Size                 | A Planet category that determines ranges for Max Population and Area.                                  |
| Max Population       | The hard limit on the number of Population units a Planet can sustain.                                 |
| Area                 | The number of Infrastructure slots available on a Planet.                                              |
| Population           | A whole-number worker unit assigned to one planetary activity.                                         |
| Food                 | A Planet-local resource produced to gain Population.                                                   |

## Rules

## Planet Attributes

Every Planet has Planet Attributes determined by its Biome and Size. Biomes make Planets legible by constraining their Resource production ranges rather than making every Planet entirely random. For example, an Oceanic Planet may tend toward high Fertility and lower Metal, while a Metallic Planet may tend toward the reverse. The Planet Size affects how much productivity the Planet will be able to sustain via caps to its Population and Infrastructure.

Planet Attributes create colonization tradeoffs. An empire sees a Planet's current Attributes while the Planet is in that empire's vision. When an empire loses vision of the Planet, it retains the last-seen Attribute values. When vision is renewed, the empire's recorded Attribute values refresh to the current values.

Every Attribute is a base value for its related production or growth. Planet Infrastructure and empire-wide modifiers multiply that base value to determine the final output.

| Attribute      | Base value for                                                            |
| -------------- | ------------------------------------------------------------------------- |
| Fertility      | Food production on the Planet that goes toward increasing the population. |
| Metal          | Metal production on the Planet.                                           |
| Fuel           | Fuel production on the Planet.                                            |
| Energy         | Energy production on the Planet.                                          |
| Max Population | Population cap.                                                           |
| Area           | Infrastructure cap.                                                       |

Terraforming may change a Planet's Attributes.

## Biomes

Each Biome constrains a Planet's resource production and gives the Planet an immediately legible character. Each Attribute rolls independently within its listed range. The following ranges are initial balancing baselines and may change as the game is developed.

| Biome    | Description                                                      | Fertility | Metal  | Fuel   | Energy |
| -------- | ---------------------------------------------------------------- | --------- | ------ | ------ | ------ |
| Oceanic  | A Planet dominated by oceans or large bodies of water.           | 2 to 4    | 1 to 2 | 1 to 3 | 1 to 2 |
| Metallic | A Planet with a metal-rich crust and sparse surface.             | 1 to 2    | 2 to 4 | 1 to 2 | 1 to 3 |
| Frozen   | A cold Planet dominated by ice and volatile deposits.            | 1 to 2    | 1 to 3 | 2 to 4 | 1 to 2 |
| Volcanic | A geologically active Planet with magma and geothermal activity. | 2 to 3    | 1 to 2 | 1 to 2 | 2 to 4 |

## Planet Size

Each Planet has a Size that determines independent ranges for Max Population and Area. These values roll independently, so a Planet can receive a low Max Population roll and a high Area roll within its Size category.

| Size   | Max Population | Area    |
| ------ | -------------- | ------- |
| Small  | 5 to 10        | 2 to 4  |
| Medium | 10 to 20       | 4 to 7  |
| Large  | 20 to 35       | 7 to 11 |

## Colonization

A Colonization Attempt requires an Unclaimed Planet, an arriving Fleet, and a Colony resource. On success, the Planet becomes owned by the colonizing empire and the Fleet is consumed.

Colonization resolves after Combat. A Colonization Attempt is valid only if its Fleet survives the encounter and remains at the Unclaimed Planet after Combat. Combat can therefore deny colonization by destroying a would-be colonizing Fleet. Valid Attempts are considered in the arrival order established by Travel Ticks, so an earlier arrival has priority over later arrivals. If multiple valid Attempts arrive on the same Travel Tick, one is selected randomly to succeed. The Fleets and Colony resources used by unsuccessful attempts return to their empires.

A newly colonized Planet starts with `min(Max Population / 2, max(2, floor(colonizing Fleet Strength / 5)))` Population. In other words, every colonized Planet starts with between 2 and half its Max Population based on the colonizing Fleet Strength divided by 5, rounded down.

## Planet Development

Ongoing planetary simulation is a core strategic system. Planets develop automatically during Turn Resolution, so population, production, construction, and fleets continue to progress without a separate player Action. This also makes missed Turns less damaging, but missed-Turn resilience is a benefit of the simulation rather than its purpose. Population is a pool of whole-number workers. Each worker is assigned to one activity: Food, Metal production, Fuel production, Energy production, Infrastructure construction, or Fleet construction. Worker allocation and construction choices follow empire-wide ideological priorities; Agendas and Directives may later provide global or local intervention.

| Activity                    | Summary                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| Food                        | Produces Planet-local Food, allowing Population growth.                     |
| Metal production            | Produces Metal from the Planet's Metal Attribute.                           |
| Fuel production             | Produces Fuel from the Planet's Fuel Attribute.                             |
| Energy production           | Produces Energy from the Planet's Energy Attribute.                         |
| Infrastructure construction | Invests locally produced resources into the current Infrastructure project. |
| Fleet construction          | Invests locally produced resources to build Fleet at the Planet.            |

For Food and resource production, output is calculated as: `assigned workers × relevant Planet Attribute × applicable modifiers`. Food production uses the Planet's Fertility Attribute.

Food workers produce Food. Food is held locally by the Planet and does not enter the empire stockpile. The Food needed for the next Population unit is `current Population^1.25`. When the Planet reaches that threshold, it gains one Population and subtracts the required Food while retaining any overflow. Population cannot exceed Max Population.

Automatic governance reassigns Food workers when the Planet reaches Max Population. If Food is nevertheless produced at the cap, it has no further growth benefit.

Infrastructure construction uses the Planet's same-turn local production. Each construction worker can invest one unit of a required Resource produced on the Planet during that Turn Resolution. For each worker, the Planet prioritizes an unfunded required Resource with the lowest planetary production; if multiple eligible Resources tie, it chooses randomly among them. If no eligible required Resource has same-turn production available, that worker invests nothing. Invested amounts persist on the current Infrastructure project between turns. The project completes only when every Resource cost is fully funded, and a Planet may complete at most one Infrastructure project per turn. The Planet cannot use resources from the empire stockpile for automatic construction; same-turn production that is not invested enters the empire stockpile.

Fleet construction uses the Planet's same-turn local Metal production. Each Fleet construction worker can invest one Metal to add one Strength to the empire's Fleet at that Planet. The Planet cannot use resources from the empire stockpile for automatic Fleet construction.

Resources not invested in Infrastructure or Fleet construction enter the empire stockpile. If an Infrastructure project completes before all construction capacity is used, remaining Infrastructure construction workers do not begin another project that turn. Each Infrastructure occupies one Area.

## Potential Flaws

Random simultaneous claims may feel unfair without enough advance information or alternative expansion opportunities.

The automation must be legible enough for players to understand why a Planet allocated workers or selected a construction project in a particular way.
