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

### Agendas

Agendas are broad Actions, generally Empire or Planet wide, that have a noticeable impact on the player Ideologies. They aim to steer how the Empire as a whole functions over multiple turns.

| Agenda | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...        | ...    | ...    | ...   | ...     |

### Directives

Directives are targeted Actions, generally affecting a Planet or a Unit, that have little to no impact on the player Ideologies. They aim to have concrete, immediate effects.

| Directive            | Tier        | Conditions  | Source  | Target            | Costs                             | Effects                                                                         |
| -------------------- | ----------- | ----------- | ------- | ----------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| Attack Move          | Standard    | N/A         | Fleet   | Planet            | 5 Influence, 1 fuel               | Travel at Speed 1, Range 5. Assault on arrival.                                 |
| Attack Move          | Exceptional | N/A         | Fleet   | Planet            | 5 Influence, 5 fuel, 5 energy     | Travel at Speed 5, Range 25. Surprise Assault on arrival.                       |
| Stealth Move         | Standard    | N/A         | Fleet   | Planet            | 3 Influence, 1 fuel, 5 energy     | Travel at Speed 1, Range 3. Cloaked in transit.                                 |
| Stealth Move         | Exceptional | N/A         | Fleet   | Planet            | 3 Influence, 3 fuel, 10 energy    | Travel at Speed 3, Range 9. Cloaked in transit and for 1 turn after arrival.    |
| Post Trade           | Standard    | N/A         | Self    | Trade Board       | 5 Influence, Trade Offering       | Post a Trade Offering for 5 turns with 15% Tax.                                 |
| Post Trade           | Exceptional | N/A         | Self    | Trade Board       | 3 Influence, Trade Offering       | Post a Trade Offering for 10 turns with 0% Tax.                                 |
| Bid on Trade         | Standard    | N/A         | Self    | Open Trade        | 5 Influence, Bid Payment          | Bid at a 100% Rate on an Open Trade.                                            |
| Bid on Trade         | Exceptional | N/A         | Self    | Open Trade        | 3 Influence, Bid Payment          | Bid at a 150% Rate on an Open Trade.                                            |
| Cancel Trade         | Standard    | N/A         | Self    | Own Open Trade    | 1 Influence                       | Cancel the Trade. Refund its Trade Offering unless the Trade settles this turn. |
| Post Contract        | Standard    | N/A         | Self    | Contract Board    | Contract Reward                   | Post a Contract for 3 turns with a 100% Reward Rate.                            |
| Post Contract        | Exceptional | N/A         | Self    | Contract Board    | Contract Reward                   | Post a Contract for 6 turns with a 200% Reward Rate.                            |
| Bid on Contract      | Standard    | N/A         | Self    | Open Contract     | Action Costs                      | Bid to complete an Open Contract for 100% of your Bid Reward.                   |
| Bid on Contract      | Exceptional | N/A         | Self    | Open Contract     | Action Costs                      | Bid to complete an Open Contract for 200% of your Bid Reward.                   |
| Cancel Contract      | Standard    | N/A         | Self    | Own Open Contract | 1 Influence                       | Cancel the Contract. Refund its escrow unless the Contract settles this turn.   |
| Colonize Planet      | Standard    | N/A         | Fleet   | Unclaimed Planet  | 25 Influence, 1 colony            | Travel at Speed 1, Range 5. Colonize on arrival.                                |
| Colonize Planet      | Exceptional | N/A         | Fleet   | Unclaimed Planet  | 25 Influence, 1 colony, 20 energy | Travel at Speed 5, Range 5. Colonize on arrival. Develop at 200% for 10 turns.  |
| Build Infrastructure | Standard    | N/A         | Self    | Owned Planet      | 10 Influence, Infrastructure Cost | Build Standard or lower Infrastructure.                                         |
| Build Infrastructure | Exceptional | N/A         | Self    | Owned Planet      | 10 Influence, Infrastructure Cost | Build Exceptional or lower Infrastructure.                                      |
| Build Fleet          | Standard    | N/A         | Self    | Owned Planet      | 10 Influence, 5 Metal             | Build a Fleet with Strength 5.                                                  |
| Build Fleet          | Exceptional | N/A         | Self    | Owned Planet      | 10 Influence, 20 Metal            | Build a Fleet with Strength 20.                                                 |
| Merge Fleets         | Standard    | Same Planet | Fleet A | Fleet B           | 5 Influence, 5 Metal, 5 Energy    | Merge Fleet A onto Fleet B.                                                     |
| ...                  | ...         | ...         | ...     | ...               | ...                               | ...                                                                             |

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
| Colonization   | [008-colonization](./008-colonization.md)     |
| Infrastructure | [009-infrastructure](./009-infrastructure.md) |
| Fleets         | [010-fleets](./010-fleets.md)                 |
| Assault        | [011-combat](./011-combat.md)                 |
| Travel         | [012-travel](./012-travel.md)                 |
| Cloaking       | [013-cloaking](./013-cloaking.md)             |

## Potential Flaws

Players might have access to too many actions at the same time, making it overwhelming and hard to choose which actions should be played.
