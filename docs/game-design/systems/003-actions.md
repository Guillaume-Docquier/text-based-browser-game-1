# Actions

## Purpose

Actions are what players do to affect their Empire. Deciding which Action(s) to take is the strategic choice that is core to the game loop.

Supports:

- [GDDR 003-turn-based](../decisions/003-turn-based.md)
- [GDDR 004-legacy-as-win-condition](../decisions/004-legacy-as-win-condition.md)
- [GDDR 005-ideological-axes](../decisions/005-ideological-axes.md)
- [GDDR 006-card-like-actions](../decisions/006-card-like-actions.md)
- [GDDR 007-asymmetric-play](../decisions/007-asymmetric-play.md)

Relates to:

- [System 001-turns](./001-turns.md)
- [System 002-legacy](./002-legacy.md)
- [System 004-ideological-alignment](./004-ideological-alignment.md)
- [System 005-political-regime](./005-political-regime.md)
- [System 014-resources](./014-resources.md)

## Core Concepts

| Concept   | Definition                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| Action    | What the player chooses their Empire should do this turn. There are 3 types of Actions: Agendas, Directives and Legacies. |
| Agenda    | A broad Action that shifts the Empire's Ideological Alignments                                                            |
| Directive | A specific Action that exploits the Empire's Ideological Alignments without affecting them                                |
| Legacy    | An action to achieve a Legacy Project. See [System 002-legacy](./002-legacy.md)                                           |
| Influence | Resource that all Actions cost. See [System 005-political-regime](./005-political-regime.md)                              |

## Rules

Actions are submitted each turn by players.

Every player-caused change to the game is made by playing an Action. Players cannot take a game-impacting action outside this system.

There are 3 types of Actions:

- Agendas
- Directives
- Legacies

The different Action types only differ in scope and flavor. Aside from that, all actions have the same card-like shape:

- They have a type (Agenda/Directive/Legacy)
- They have a tier (Basic/Standard/Improved/Advanced/Exceptional)
- They may have pre-condition(s)
- They have source(s)
- They have target(s)
- They have cost(s)
- They have effect(s)

All Actions cost Influence, and usually cost additional resources. The player's Political Regime will affect the Influence Cost and the Action's efficiency.

The available Action pool every turn will be dictated by the player's ideological alignments. Every Action in the pool can be used once per turn.

To play an Action, a player will have to meet the pre-conditions, have a valid source, have a valid target and be able to pay the costs. The pre-conditions might be things like "no other Agendas played this turn" or "no other Legacy Project in progress". The Action source and target could be the empire, a planet or a unit.

The costs are spent only when the turn ends, but the player will not be allowed to play Actions that would overspend. A visual indicator will let the user know how much of each resource they have in total, and how much they will have after paying the costs of all their Actions. Whenever an Action is canceled or prevented, the Influence cost is always spent and is never refunded. Other resources may be refunded, depending on the Action.

### Action Tiers

| Tier Name   | Tier Number |
| ----------- | ----------- |
| Basic       | T5          |
| Standard    | T4          |
| Improved    | T3          |
| Advanced    | T2          |
| Exceptional | T1          |

### Agendas

Agendas are broad Actions, generally Empire or Planet wide, that have a noticeable impact on the player Ideologies. They aim to steer how the Empire as a whole functions over multiple turns.

| Agenda | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...        | ...    | ...    | ...   | ...     |

### Directives

Directives are targeted Actions, generally affecting a Planet or a Unit, that have little to no impact on the player Ideologies. They aim to have concrete, immediate effects.

| Directive            | Tier | Conditions | Source         | Target            | Costs                             | Effects                                                                                        | Core |
| -------------------- | ---- | ---------- | -------------- | ----------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- | ---- |
| Attack Move          | T4   | N/A        | Fleet Strength | Planet            | 5 Influence, 1 fuel               | Travel selected Strength at Speed 1, Range 5. Assault on arrival.                              | Yes  |
| Attack Move          | T1   | N/A        | Fleet Strength | Planet            | 5 Influence, 5 fuel, 5 energy     | Travel selected Strength at Speed 5, Range 25. Surprise Assault on arrival.                    |      |
| Move                 | T4   | N/A        | Fleet Strength | Planet            | 3 Influence, 1 fuel               | Travel selected Strength at Speed 1, Range 5.                                                  | Yes  |
| Move                 | T1   | N/A        | Fleet Strength | Planet            | 3 Influence, 5 fuel               | Travel selected Strength at Speed 5, Range 25.                                                 |      |
| Stealth Move         | T4   | N/A        | Fleet Strength | Planet            | 3 Influence, 1 fuel, 5 energy     | Travel selected Strength at Speed 1, Range 3. Cloaked in transit.                              |      |
| Stealth Move         | T1   | N/A        | Fleet Strength | Planet            | 3 Influence, 3 fuel, 10 energy    | Travel selected Strength at Speed 3, Range 9. Cloaked in transit and for 1 turn after arrival. |      |
| Post Trade           | T4   | N/A        | Self           | Trade Board       | 5 Influence, Trade Offering       | Post a Trade Offering for 5 turns with 15% Tax.                                                | Yes  |
| Post Trade           | T1   | N/A        | Self           | Trade Board       | 3 Influence, Trade Offering       | Post a Trade Offering for 10 turns with 0% Tax.                                                |      |
| Bid on Trade         | T4   | N/A        | Self           | Open Trade        | 5 Influence, Bid Payment          | Bid at a 100% Rate on an Open Trade.                                                           | Yes  |
| Bid on Trade         | T1   | N/A        | Self           | Open Trade        | 3 Influence, Bid Payment          | Bid at a 150% Rate on an Open Trade.                                                           |      |
| Cancel Trade         | T4   | N/A        | Self           | Own Open Trade    | 1 Influence                       | Cancel the Trade. Refund its Trade Offering unless the Trade settles this turn.                | Yes  |
| Post Contract        | T4   | N/A        | Self           | Contract Board    | Contract Reward                   | Post a Contract for 3 turns with a 100% Reward Rate.                                           | Yes  |
| Post Contract        | T1   | N/A        | Self           | Contract Board    | Contract Reward                   | Post a Contract for 6 turns with a 200% Reward Rate.                                           |      |
| Bid on Contract      | T4   | N/A        | Self           | Open Contract     | Action Costs                      | Bid to complete an Open Contract for 100% of your Bid Reward.                                  | Yes  |
| Bid on Contract      | T1   | N/A        | Self           | Open Contract     | Action Costs                      | Bid to complete an Open Contract for 200% of your Bid Reward.                                  |      |
| Cancel Contract      | T4   | N/A        | Self           | Own Open Contract | 1 Influence                       | Cancel the Contract. Refund its escrow unless the Contract settles this turn.                  | Yes  |
| Colonize Planet      | T4   | N/A        | Fleet          | Unclaimed Planet  | 25 Influence, 1 colony            | Travel at Speed 1, Range 5. Colonize on arrival.                                               |      |
| Colonize Planet      | T1   | N/A        | Fleet          | Unclaimed Planet  | 25 Influence, 1 colony, 20 energy | Travel at Speed 5, Range 5. Colonize on arrival. Develop at 200% for 10 turns.                 |      |
| Build Infrastructure | T4   | N/A        | Self           | Owned Planet      | 10 Influence, Infrastructure Cost | Build Standard or lower Infrastructure.                                                        | Yes  |
| Build Infrastructure | T1   | N/A        | Self           | Owned Planet      | 10 Influence, Infrastructure Cost | Build Exceptional or lower Infrastructure.                                                     |      |
| Build Fleet          | T4   | N/A        | Self           | Owned Planet      | 10 Influence, 5 Metal             | Build a Fleet with Strength 5.                                                                 | Yes  |
| Build Fleet          | T1   | N/A        | Self           | Owned Planet      | 10 Influence, 20 Metal            | Build a Fleet with Strength 20.                                                                |      |
| ...                  | ...  | ...        | ...            | ...               | ...                               | ...                                                                                            |      |

Note: Every Post Trade/Contract Action always comes with a Cancel Trade/Contract Action. It will not be explicitly written out in all documents to alleviate the text.

### Legacies

Legacies are big undertakings that span multiple turns. They reward a lot of Legacy points when they complete their Legacy Project.

| Legacy | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...        | ...    | ...    | ...   | ...     |

### Detailed Mechanics

The action table uses compact effect text. Detailed definitions live in the related system documents:

| Mechanic       | System                                        |
| -------------- | --------------------------------------------- |
| Trade          | [006-trade](./006-trade.md)                   |
| Contracts      | [007-contracts](./007-contracts.md)           |
| Colonization   | [008-planets](./008-planets.md)               |
| Infrastructure | [009-infrastructure](./009-infrastructure.md) |
| Fleets         | [010-fleets](./010-fleets.md)                 |
| Assault        | [011-combat](./011-combat.md)                 |
| Travel         | [012-travel](./012-travel.md)                 |
| Cloaking       | [010-fleets](./010-fleets.md)                 |

### Action Pool

Players will always have access to 1 Standard of every Action in the core pool. Then, each Axis will provide more or better Actions. Each axis defines its own Action pool.

Core Action Pool:

| Action               | Type      | Tier | Quantity |
| -------------------- | --------- | ---- | -------: |
| Move                 | Directive | T4   |        1 |
| Post Trade           | Directive | T4   |        1 |
| Bid on Trade         | Directive | T4   |        1 |
| Cancel Trade         | Directive | T4   |        1 |
| Post Contract        | Directive | T4   |        1 |
| Bid on Contract      | Directive | T4   |        1 |
| Cancel Contract      | Directive | T4   |        1 |
| Build Infrastructure | Directive | T4   |        1 |
| Build Fleet          | Directive | T4   |        1 |

The Empire's [System 004-ideological-alignment](./004-ideological-alignment.md) provides access to more and better Actions depending on the Stance.

## Potential Flaws

Players might have access to too many actions at the same time, making it overwhelming and hard to choose which actions should be played.
