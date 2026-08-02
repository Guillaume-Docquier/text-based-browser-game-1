# Planets

## Purpose

Planets are the places empires develop, fight over, and colonize. Their Biomes and Attributes create the local tradeoffs that shape expansion.

Supports:

- [GDDR 004-legacy-as-win-condition](../decisions/004-legacy-as-win-condition.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 012-travel](./012-travel.md)
- [System 001-turns](./001-turns.md)
- [System 014-resources](./014-resources.md)

## Core Concepts

| Concept              | Definition                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Planet               | A fixed location in the galaxy that may be Unclaimed or owned by an empire.                            |
| Unclaimed Planet     | A Planet with no owner that may be claimed through colonization.                                       |
| Colony               | A resource required to attempt colonization.                                                           |
| Colonization Attempt | An empire's attempt to establish ownership of an Unclaimed Planet with a Fleet that has arrived there. |
| Biome                | A planet classification that constrains the initial ranges of its attributes.                          |
| Planet Attribute     | A public statistic of a Planet that affects its capabilities and resource production.                  |

## Planet Attributes

Every Planet has a Biome and public Planet Attributes. Biomes make planets legible by constraining their initial attribute ranges rather than making every planet entirely random. For example, an Oceanic Planet may tend toward high Fertility and lower Mineral Richness, while a Metallic Planet may tend toward the reverse.

Planet Attributes create colonization tradeoffs. A Planet's Biome and Attributes are visible only while the Planet is in an empire's vision.

Every Attribute is a base value for its related production or growth. Planet Infrastructure and empire-wide modifiers multiply that base value to determine the final output.

| Attribute | Base value for                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| Fertility | Population growth on the Planet.                                                                                     |
| Metal     | Metal production on the Planet.                                                                                      |
| Fuel      | Fuel production on the Planet.                                                                                       |
| Energy    | Energy production on the Planet.                                                                                     |
| Size      | How much room there is on the planet. This will affect the infrastructure and population that the planet can sustain |

Terraforming may change a Planet's Attributes.

## Biomes

Each Biome constrains a Planet's initial Attributes and gives the Planet an immediately legible character. Each Attribute rolls independently within its listed range. The following ranges are initial balancing baselines and may change as the game is developed.

| Biome    | Description                                                      | Fertility | Metal  | Fuel   | Energy |
| -------- | ---------------------------------------------------------------- | --------- | ------ | ------ | ------ |
| Oceanic  | A Planet dominated by oceans or large bodies of water.           | 2 to 4    | 0 to 2 | 1 to 3 | 0 to 2 |
| Metallic | A Planet with a metal-rich crust and sparse surface.             | 0 to 2    | 2 to 4 | 0 to 2 | 1 to 3 |
| Frozen   | A cold Planet dominated by ice and volatile deposits.            | 0 to 2    | 1 to 3 | 2 to 4 | 0 to 2 |
| Volcanic | A geologically active Planet with magma and geothermal activity. | 1 to 3    | 0 to 2 | 0 to 2 | 2 to 4 |

## Colonization

A Colonization Attempt requires an Unclaimed Planet, an arriving Fleet, and a Colony resource. On success, the Planet becomes owned by the colonizing empire and the Fleet is consumed.

Colonization resolves after Combat. A Colonization Attempt is valid only if its Fleet survives the encounter and remains at the Unclaimed Planet after Combat. Combat can therefore deny colonization by destroying a would-be colonizing Fleet. Valid Attempts are considered in the arrival order established by Travel Ticks, so an earlier arrival has priority over later arrivals. If multiple valid Attempts arrive on the same Travel Tick, one is selected randomly to succeed. The Fleets and Colony resources used by unsuccessful attempts return to their empires.

## Planet Development

TBD

## Potential Flaws

Random simultaneous claims may feel unfair without enough advance information or alternative expansion opportunities.
