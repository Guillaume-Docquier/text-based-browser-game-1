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
| Action Set       | The Actions associated with a Stance on an Ideological Axis.       |

## Rules

Each Ideological Axis has Stances from -5 to 5. A Stance of 0 is neutral; -5 and 5 are its opposing extremes. An empire has one Stance on each Axis.

An empire's Stances determine its available Actions. Each table row lists the complete Action Set available at that Stance. The set is the union of Actions associated with the Stance itself and the adjacent Stances within a window of -1 to +1, clipped at -5 and 5.

## Ideological Axes

| Axis        | Theme                                         | -5 extreme   | 5 extreme   |
| ----------- | --------------------------------------------- | ------------ | ----------- |
| Diplomacy   | How an empire relates to other empires.       | Isolationist | Cooperative |
| Environment | How an empire uses and preserves its Planets. | Industrial   | Ecologist   |
| Military    | How an empire approaches military conflict.   | Defensive    | Offensive   |

## Diplomacy

|            Stance | Action Set                                                                                                                                                |
| ----------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (Isolationist) -5 | Exceptional Build Infrastructure x2, Exceptional Build Fleet x2                                                                                           |
|                -4 | Build Infrastructure x2, Build Fleet x2, Colonize Planet                                                                                                  |
|                -3 | Exceptional Build Infrastructure, Exceptional Build Fleet                                                                                                 |
|                -2 | Post Trade, Bid on Trade, Post Contract, Bid on Contract                                                                                                  |
|                -1 | Build Infrastructure, Build Fleet                                                                                                                         |
|                 0 | Post Trade, Bid on Trade, Post Contract, Bid on Contract, Build Infrastructure, Build Fleet                                                               |
|                 1 | Post Trade, Bid on Trade, Post Contract, Bid on Contract                                                                                                  |
|                 2 | Build Infrastructure, Build Fleet                                                                                                                         |
|                 3 | Exceptional Post Trade, Exceptional Post Contract, Exceptional Bid on Trade, Exceptional Bid on Contract, Cancel Trade, Cancel Contract                   |
|                 4 | Post Trade x2, Post Contract x2, Bid on Trade x2, Bid on Contract x2, Cancel Trade x2, Cancel Contract x2                                                 |
|   (Cooperative) 5 | Exceptional Post Trade x2, Exceptional Post Contract x2, Exceptional Bid on Trade x2, Exceptional Bid on Contract x2, Cancel Trade x2, Cancel Contract x2 |

## Environment

|          Stance | Action Set                                                                                  |
| --------------: | ------------------------------------------------------------------------------------------- |
| (Industrial) -5 | Exceptional Build Infrastructure x2, Exceptional Bid on Contract, Bid on Contract           |
|              -4 | Build Infrastructure, Post Contract, Bid on Trade x2                                        |
|              -3 | Bid on Contract, Bid on Trade, Exceptional Build Infrastructure                             |
|              -2 | Colonize Planet, Move                                                                       |
|              -1 | Build Infrastructure, Build Fleet                                                           |
|               0 | Colonize Planet, Move, Build Infrastructure, Build Fleet                                    |
|               1 | Colonize Planet, Move                                                                       |
|               2 | Build Infrastructure, Build Fleet                                                           |
|               3 | Stealth Move, Exceptional Move, Build Fleet                                                 |
|               4 | Colonize Planet, Build Fleet x2, Move x2, Post Contract, Bid on Trade                       |
|   (Ecologist) 5 | Exceptional Colonize Planet, Exceptional Stealth Move, Exceptional Move x2, Bid on Contract |

## Military

|         Stance | Action Set                                                                         |
| -------------: | ---------------------------------------------------------------------------------- |
| (Defensive) -5 | Exceptional Stealth Move, Move x2, Build Fleet x3, Colonize Planet                 |
|             -4 | Stealth Move, Move, Build Fleet x2                                                 |
|             -3 | Stealth Move, Move, Build Fleet, Build Infrastructure                              |
|             -2 | Stealth Move, Move, Build Fleet                                                    |
|             -1 | Move x2                                                                            |
|              0 | Move, Attack Move, Build Fleet                                                     |
|              1 | Attack Move x2                                                                     |
|              2 | Exceptional Attack Move, Build Fleet                                               |
|              3 | Exceptional Attack Move, Build Fleet, Build Infrastructure                         |
|              4 | Attack Move x2, Build Fleet x2                                                     |
|  (Offensive) 5 | Exceptional Attack Move x2, Exceptional Build Fleet, Bid on Contract, Bid on Trade |

## Potential Flaws

- Extreme Stances can become dominant if their specialized Actions outweigh the flexibility of neutral Stances.
- The system must clearly show how an Action changes a Stance and which Actions that change will make available or unavailable.
