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

Players will always have access to 1 Standard of every Action in the core pool. Then, each Axis will provide more or better Actions. Each axis defines its own Action pool.

## Core Action Pool

- Move
- Post Trade
- Bid on Trade
- Cancel Trade
- Post Contract
- Bid on Contract
- Cancel Contract
- Build Infrastructure
- Build Fleet

## Ideological Axes

| Axis      | Theme                                        | -5 extreme   | 5 extreme   |
| --------- | -------------------------------------------- | ------------ | ----------- |
| Diplomacy | How an empire relates to other empires.      | Isolationist | Cooperative |
| Industry  | How an empire uses and exploits its Planets. | Industrial   | Ecologist   |
| Military  | How an empire approaches military conflict.  | Defensive    | Offensive   |

### Diplomacy

Isolationist aims at doing everything themselves, while Cooperative empires aim at getting what they are missing from other empires via trades and contracts.

|            Stance | Action Set                                                           |
| ----------------: | -------------------------------------------------------------------- |
| (Isolationist) -5 | T1 Build Infrastructure, T1 Build Fleet                              |
|                -4 | T4 Build Infrastructure, T1 Build Fleet                              |
|                -3 | T4 Build Infrastructure, T4 Build Fleet                              |
|                -2 | T4 Build Infrastructure                                              |
|                -1 | T4 Build Fleet                                                       |
|                 0 | T4 Colonize Planet                                                   |
|                 1 | T4 Post Trade, T4 Bid on Trade                                       |
|                 2 | T4 Post Contract, T4 Bid on Contract                                 |
|                 3 | T4 Post Trade, T4 Bid on Trade, T4 Post Contract, T4 Bid on Contract |
|                 4 | T4 Post Trade, T4 Bid on Trade, T1 Post Contract, T1 Bid on Contract |
|   (Cooperative) 5 | T1 Post Trade, T1 Bid on Trade, T1 Post Contract, T1 Bid on Contract |

### Industry

Industrial aims at exploiting planets by building infrastructure and are also interested in exploiting other empire's planets via bidding on contracts. Ecologists aim at colonizing planets and exploration, while asking other empires to fill certain gaps they might not be willing to do themselves via contracts.

|          Stance | Action Set                                   |
| --------------: | -------------------------------------------- |
| (Industrial) -5 | T1 Build Infrastructure, T1 Bid on Contract  |
|              -4 | T1 Build Infrastructure, T4 Bid on Contract  |
|              -3 | T4 Build Infrastructure, T4 Bid on Contract  |
|              -2 | T4 Build Infrastructure, T4 Colonize Planet  |
|              -1 | T4 Colonize Planet                           |
|               0 | T4 Build Fleet                               |
|               1 | T4 Build Fleet                               |
|               2 | T4 Move,                                     |
|               3 | T4 Move, T4 Colonize Planet                  |
|               4 | T1 Move, T1 Bid on Trade                     |
|   (Ecologist) 5 | T1 Move, T1 Colonize Planet, T1 Bid on Trade |

### Military

Defensive aims at building fleets everywhere and positioning them, but rarely attack. Offensive aims at fueling their war infrastructure and attacking a lot, but their fleet building diversity is more limited and concentrates into their war front.

|         Stance | Action Set                                                  |
| -------------: | ----------------------------------------------------------- |
| (Defensive) -5 | T4 Stealth Move, T4 Attack Move, T1 Move, T4 Build Fleet x4 |
|             -4 | T4 Stealth Move, T4 Attack Move, T4 Move, T4 Build Fleet x2 |
|             -3 | T4 Stealth Move, T4 Move, T4 Build Fleet                    |
|             -2 | T4 Stealth Move, T4 Build Fleet                             |
|             -1 | T4 Move, T4 Build Fleet x2                                  |
|              0 | T4 Move                                                     |
|              1 | T4 Move, T4 Build Fleet                                     |
|              2 | T4 Attack Move, T4 Build Fleet                              |
|              3 | T4 Attack Move, T4 Move, T4 Build Fleet                     |
|              4 | T1 Attack Move, T4 Move, T4 Build Fleet x2                  |
|  (Offensive) 5 | T1 Attack Move, T1 Stealth Move, T1 Build Fleet             |

## Potential Flaws

- Extreme Stances can become dominant if their specialized Actions outweigh the flexibility of neutral Stances.
- The system must clearly show how an Action changes a Stance and which Actions that change will make available or unavailable.
