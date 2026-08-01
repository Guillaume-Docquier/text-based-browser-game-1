# Colonization

## Purpose

Colonization lets empires claim Unclaimed Planets and expand their presence in the galaxy.

Supports:

- [GDDR 004-legacy-as-win-condition](../decisions/004-legacy-as-win-condition.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 012-travel](./012-travel.md)

## Core Concepts

| Concept          | Definition                                    |
| ---------------- | --------------------------------------------- |
| Unclaimed Planet | A Planet with no owner that may be colonized. |
| Colony           | A resource required to attempt colonization.  |

## Rules

Colonize Planet requires a Fleet to travel to an Unclaimed Planet. When the Fleet arrives, the Planet becomes owned by the empire receiving the Action's effects and the Fleet is consumed.

If multiple valid Colonize actions arrive at the same Unclaimed Planet during one turn resolution, one is selected randomly to succeed. All other attempts fail: their Fleets remain intact and non-Influence resources return. Influence is still spent.

An Exceptional Colonize Planet action can make the new Planet develop at 200% of its normal development rate for 10 turns.

The initial state of a newly colonized Planet and the details of Planet development are not yet defined.

## Potential Flaws

Random simultaneous claims may feel unfair without enough advance information or alternative expansion opportunities.
