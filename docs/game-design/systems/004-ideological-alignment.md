# Ideological Alignment

## Purpose

Ideological Alignment defines an empire's strategic identity and the Actions available to it. Each Axis creates a tradeoff between opposing playstyles.

Supports:

- [GDDR 005-ideological-axes](../decisions/005-ideological-axes.md)
- [GDDR 006-card-like-actions](../decisions/006-card-like-actions.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 005-political-regime](./005-political-regime.md)

## Core Concepts

| Concept          | Definition                                                         |
| ---------------- | ------------------------------------------------------------------ |
| Ideological Axis | A spectrum between two opposing empire philosophies.               |
| Stance           | An empire's current whole-number position on one Ideological Axis. |
| Action Set       | The complete Actions available at a Stance on an Ideological Axis. |

## Rules

Each Ideological Axis has Stances from -5 to 5. A Stance of 0 is neutral; -5 and 5 are its opposing extremes. An empire has one Stance on each Axis.

An empire's Stances determine its available Actions. Each table row lists the complete Action Set available at that Stance. Repeated Actions between axes add together.

## Ideological Axes

| Axis        | Theme                                         | -5 extreme   | 5 extreme   |
| ----------- | --------------------------------------------- | ------------ | ----------- |
| Diplomacy   | How an empire relates to other empires.       | Isolationist | Cooperative |
| Environment | How an empire uses and preserves its Planets. | Industrial   | Ecologist   |
| Military    | How an empire approaches military conflict.   | Defensive    | Offensive   |

## Diplomacy

Isolationist aims at doing everything themselves, while Cooperative empires aim at getting what they are missing from other empires via trades and contracts.

|            Stance | Action Set                                                                                                                                                                                                                                             |
| ----------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (Isolationist) -5 | Exceptional Build Infrastructure x2, Exceptional Build Fleet x2, Build Infrastructure x2, Build Fleet x2, Colonize Planet                                                                                                                              |
|                -4 | Exceptional Build Infrastructure x3, Exceptional Build Fleet x3, Build Infrastructure x2, Build Fleet x2, Colonize Planet                                                                                                                              |
|                -3 | Build Infrastructure x2, Build Fleet x2, Colonize Planet, Exceptional Build Infrastructure, Exceptional Build Fleet, Post Trade, Bid on Trade, Post Contract, Bid on Contract                                                                          |
|                -2 | Exceptional Build Infrastructure, Exceptional Build Fleet, Post Trade, Bid on Trade, Post Contract, Bid on Contract, Build Infrastructure, Build Fleet                                                                                                 |
|                -1 | Post Trade x2, Bid on Trade x2, Post Contract x2, Bid on Contract x2, Build Infrastructure x2, Build Fleet x2                                                                                                                                          |
|                 0 | Post Trade x2, Bid on Trade x2, Post Contract x2, Bid on Contract x2, Build Infrastructure x2, Build Fleet x2                                                                                                                                          |
|                 1 | Post Trade x2, Bid on Trade x2, Post Contract x2, Bid on Contract x2, Build Infrastructure x2, Build Fleet x2                                                                                                                                          |
|                 2 | Post Trade, Bid on Trade, Post Contract, Bid on Contract, Build Infrastructure, Build Fleet, Exceptional Post Trade, Exceptional Post Contract, Exceptional Bid on Trade, Exceptional Bid on Contract, Cancel Trade, Cancel Contract                   |
|                 3 | Build Infrastructure, Build Fleet, Exceptional Post Trade, Exceptional Post Contract, Exceptional Bid on Trade, Exceptional Bid on Contract, Post Trade x2, Bid on Trade x2, Post Contract x2, Bid on Contract x2, Cancel Trade x3, Cancel Contract x3 |
|                 4 | Exceptional Post Trade x3, Exceptional Post Contract x3, Exceptional Bid on Trade x3, Exceptional Bid on Contract x3, Post Trade x2, Bid on Trade x2, Post Contract x2, Bid on Contract x2, Cancel Trade x5, Cancel Contract x5                        |
|   (Cooperative) 5 | Post Trade x2, Bid on Trade x2, Post Contract x2, Bid on Contract x2, Exceptional Post Trade x2, Exceptional Post Contract x2, Exceptional Bid on Trade x2, Exceptional Bid on Contract x2, Cancel Trade x4, Cancel Contract x4                        |

## Environment

Industrial aims at exploiting planets by building infrastructure and are also interested in exploiting other empire's planets via bidding on contracts. Ecologists aim at colonizing planets and exploration, while asking other empires to fill certain gaps they might not be willing to do themselves via contracts.

|          Stance | Action Set                                                                                                                                                                       |
| --------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (Industrial) -5 | Exceptional Build Infrastructure x2, Exceptional Bid on Contract, Bid on Contract, Build Infrastructure, Post Contract, Bid on Trade x2                                          |
|              -4 | Exceptional Build Infrastructure x3, Exceptional Bid on Contract, Bid on Contract x2, Build Infrastructure, Post Contract, Bid on Trade x3                                       |
|              -3 | Build Infrastructure, Post Contract, Bid on Trade x3, Bid on Contract, Exceptional Build Infrastructure, Colonize Planet, Move                                                   |
|              -2 | Bid on Contract, Bid on Trade, Exceptional Build Infrastructure, Colonize Planet, Move, Build Infrastructure, Build Fleet                                                        |
|              -1 | Colonize Planet x2, Move x2, Build Infrastructure x2, Build Fleet x2                                                                                                             |
|               0 | Colonize Planet x2, Move x2, Build Infrastructure x2, Build Fleet x2                                                                                                             |
|               1 | Colonize Planet x2, Move x2, Build Infrastructure x2, Build Fleet x2                                                                                                             |
|               2 | Colonize Planet, Move, Build Infrastructure, Build Fleet x2, Stealth Move, Exceptional Move                                                                                      |
|               3 | Build Infrastructure, Build Fleet x4, Stealth Move, Exceptional Move, Colonize Planet, Move x2, Post Contract, Bid on Trade                                                      |
|               4 | Stealth Move, Exceptional Stealth Move, Exceptional Move x3, Build Fleet x3, Colonize Planet, Move x2, Post Contract, Bid on Trade, Exceptional Colonize Planet, Bid on Contract |
|   (Ecologist) 5 | Colonize Planet, Build Fleet x2, Move x2, Post Contract, Bid on Trade, Exceptional Colonize Planet, Exceptional Stealth Move, Exceptional Move x2, Bid on Contract               |

## Military

Defensive aims at building fleets everywhere and positioning them, but rarely attack. Offensive aims at fueling their war infrastructure and attacking a lot, but their fleet building diversity is more limited and concentrates into their war front.

|         Stance | Action Set                                                                                                                               |
| -------------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| (Defensive) -5 | Exceptional Stealth Move, Move x3, Build Fleet x5, Colonize Planet, Stealth Move                                                         |
|             -4 | Exceptional Stealth Move, Move x4, Build Fleet x6, Colonize Planet, Stealth Move x2, Build Infrastructure                                |
|             -3 | Stealth Move x3, Move x3, Build Fleet x4, Build Infrastructure                                                                           |
|             -2 | Stealth Move x2, Move x4, Build Fleet x2, Build Infrastructure                                                                           |
|             -1 | Stealth Move, Move x4, Build Fleet x2, Attack Move                                                                                       |
|              0 | Move x3, Attack Move x3, Build Fleet                                                                                                     |
|              1 | Move, Attack Move x3, Exceptional Attack Move, Build Fleet x2                                                                            |
|              2 | Attack Move x2, Exceptional Attack Move x2, Build Fleet x2, Build Infrastructure                                                         |
|              3 | Exceptional Attack Move x2, Build Fleet x4, Build Infrastructure, Attack Move x2                                                         |
|              4 | Exceptional Attack Move x3, Build Fleet x3, Build Infrastructure, Attack Move x2, Exceptional Build Fleet, Bid on Contract, Bid on Trade |
|  (Offensive) 5 | Attack Move x2, Build Fleet x2, Exceptional Attack Move x2, Exceptional Build Fleet, Bid on Contract, Bid on Trade                       |

## Potential Flaws

- Extreme Stances can become dominant if their specialized Actions outweigh the flexibility of neutral Stances.
- The system must clearly show how an Action changes a Stance and which Actions that change will make available or unavailable.
