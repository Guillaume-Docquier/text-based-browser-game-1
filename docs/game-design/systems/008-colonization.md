# Colonization

## Purpose

Colonization is how empires claim Unclaimed Planets and expand their presence in the galaxy.

Supports:

- [GDDR 004-legacy-as-win-condition](../decisions/004-legacy-as-win-condition.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 012-travel](./012-travel.md)
- [System 001-turns](./001-turns.md)

## Core Concepts

| Concept              | Definition                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Unclaimed Planet     | A Planet with no owner that may be claimed through colonization.                                       |
| Colony               | A resource required to attempt colonization.                                                           |
| Colonization Attempt | An empire's attempt to establish ownership of an Unclaimed Planet with a Fleet that has arrived there. |

## Rules

A Colonization Attempt requires an Unclaimed Planet, an arriving Fleet, and a Colony resource. On success, the Planet becomes owned by the colonizing empire and the Fleet is consumed.

Colonization resolves after Combat. A Colonization Attempt is valid only if its Fleet survives the encounter and remains at the Unclaimed Planet after Combat. Combat can therefore deny colonization by destroying a would-be colonizing Fleet. Valid Attempts are considered in the arrival order established by Travel Ticks, so an earlier arrival has priority over later arrivals. If multiple valid Attempts arrive on the same Travel Tick, one is selected randomly to succeed. The Fleets and Colony resources used by unsuccessful attempts return to their empires.

### Planet Attributes

TBD

### Planet Development

TBD

## Potential Flaws

Random simultaneous claims may feel unfair without enough advance information or alternative expansion opportunities.
