# Actions

## Status

Partially Implemented

- [x] Data-driven Action Definitions
- [x] Agenda, Directive, and Program presentation
- [x] Action tier, cost, effect, and affordability presentation
- [x] Available Action pool
- [x] Multiple Action submissions
- [ ] Ideology-driven Action pools

## Purpose

Actions are what players do to affect their Empire. Deciding which Action(s) to take is the strategic choice that is core to the game loop.

Supports:

- [GDDR 003-turn-based](../decisions/003-turn-based.md)
- [GDDR 004-legacy-as-win-condition](../decisions/004-legacy-as-win-condition.md)
- [GDDR 005-ideological-axes](../decisions/005-ideological-axes.md)
- [GDDR 006-card-like-actions](../decisions/006-card-like-actions.md)
- [GDDR 007-asymmetric-play](../decisions/007-asymmetric-play.md)
- [GDDR 009-deterministic-data-driven-rules-engine](../decisions/009-deterministic-data-driven-rules-engine.md)

Relates to:

- [System 001-turns](./001-turns.md)
- [System 002-legacy](./002-legacy.md)
- [System 004-ideological-alignment](./004-ideological-alignment.md)
- [System 005-political-regime](./005-political-regime.md)
- [System 006-trade](./006-trade.md)
- [System 007-contracts](./007-contracts.md)
- [System 008-planets](./008-planets.md)
- [System 009-infrastructure](./009-infrastructure.md)
- [System 010-fleets](./010-fleets.md)
- [System 011-combat](./011-combat.md)
- [System 012-movement](012-movement.md)
- [System 014-resources](./014-resources.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept                   | Definition                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action Definition         | The Ruleset content that declares an Action's presentation, type, tier, prerequisites, costs, composed Mechanics, sources, inputs, and target slots.                            |
| Available Action Instance | A currently usable instance of an Action Definition offered to a player, including its exact server-provided source, input, and target candidates.                              |
| Action Submission         | A player's proposed use of an Available Action Instance with selected sources, inputs, and targets.                                                                             |
| Action                    | Player-facing shorthand for the definition, available instance, or submission when that distinction is not important. There are three types: Agendas, Directives, and Programs. |
| Agenda                    | A broad Action that shifts the Empire's Ideological Alignments.                                                                                                                 |
| Directive                 | A specific Action that exploits the Empire's Ideological Alignments without affecting them.                                                                                     |
| Program                   | An Action to achieve a Legacy Project. See [System 002-legacy](./002-legacy.md).                                                                                                |
| Effect                    | Player-facing shorthand for what an Action does; the Rules Engine produces concrete Effects from the Action Definition's composed Mechanics.                                    |
| Influence                 | Resource that all Actions cost. See [System 005-political-regime](./005-political-regime.md).                                                                                   |

## Current Implementation

The Standard Ruleset currently provides placeholder actions to represent all types, tiers and resource costs. The frontend renders each definition's type, tier, costs, Mechanic text, and affordability.

## Rules

The game's Ruleset contains Action Definitions. During each Turn, the server evaluates the current game state and gives each player their Available Action Instances. Multiple instances can share one Action Definition, such as several opportunities to use the same Move definition.

Each instance includes the exact currently valid source, input, and target candidates. The client displays those server-provided choices and does not derive legality from player state. Playing an Action creates an Action Submission containing the player's selections. The server validates the submission when received and again during Turn Resolution.

Every player-caused change to the game is made through an Action Submission. Players cannot take a game-impacting action outside this system.

There are 3 types of Actions:

- Agendas
- Directives
- Programs

The different Action types only differ in scope and flavor. Aside from that, all Action Definitions have the same card-like shape:

- They have presentation data
- They have a type (Agenda/Directive/Program)
- They have a tier (Basic/Standard/Improved/Advanced/Exceptional)
- They may have prerequisite(s)
- They have source and input requirements
- They have target slots
- They have cost(s)
- They compose Mechanic(s), presented to players as the Action's effect(s)

All Actions cost Influence, and usually cost additional resources. The player's Political Regime will affect the Influence Cost and the Action's efficiency.

The available Action pool every Turn will be dictated by the player's ideological alignments. Each entry in the pool becomes a distinct Available Action Instance and can be submitted once per Turn.

To submit an Action, a player will have to meet the prerequisites, choose from the instance's valid sources, inputs, and targets, and be able to pay the costs across all their submissions. The prerequisites might be things like "no other Agendas played this Turn" or "no other Legacy Project in progress". An Action source or target could be the Empire, a Planet, or a unit.

Costs are validated and accounted for across the player's Action Submissions, but they are spent in the Pay Costs Phase after the Turn ends. A visual indicator will let the user know how much of each Resource they have in total, committed by current submissions, and expected to have after paying all locked submissions.

A submission withdrawn or revised while the Turn is open has not yet paid its costs. Once submissions are locked, Pay Costs resolves before downstream Effects. If a locked Action is later prevented, its Influence cost remains spent. Whether another Resource is refunded must be defined by that Action and the related system. Not all Action will be refundable.

### Action Tiers

| Tier Name   | Tier Number |
| ----------- | ----------- |
| Basic       | T5          |
| Standard    | T4          |
| Improved    | T3          |
| Advanced    | T2          |
| Exceptional | T1          |

### Agendas

Agendas are broad Actions, generally Empire or Planet wide, that have a noticeable impact on the player Ideologies. They aim to steer how the Empire as a whole functions over multiple Turns.

| Agenda | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...        | ...    | ...    | ...   | ...     |

### Directives

Directives are targeted Actions, generally affecting a Planet or a Unit, that have little to no impact on the player Ideologies. They aim to have concrete, immediate effects.

| Directive            | Tier | Conditions | Source         | Target            | Costs                             | Effects                                                                                      | Core |
| -------------------- | ---- | ---------- | -------------- | ----------------- | --------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| Attack Move          | T4   | N/A        | Fleet Strength | Planet            | 5 Influence, 1 fuel               | Move selected Strength at Speed 1, Range 5. Assault on arrival.                              |      |
| Attack Move          | T1   | N/A        | Fleet Strength | Planet            | 5 Influence, 5 fuel, 5 energy     | Move selected Strength at Speed 5, Range 25. Surprise Assault on arrival.                    |      |
| Move                 | T4   | N/A        | Fleet Strength | Planet            | 3 Influence, 1 fuel               | Move selected Strength at Speed 1, Range 5.                                                  | Yes  |
| Move                 | T1   | N/A        | Fleet Strength | Planet            | 3 Influence, 5 fuel               | Move selected Strength at Speed 5, Range 25.                                                 |      |
| Stealth Move         | T4   | N/A        | Fleet Strength | Planet            | 3 Influence, 1 fuel, 5 energy     | Move selected Strength at Speed 1, Range 3. Cloaked in transit.                              |      |
| Stealth Move         | T1   | N/A        | Fleet Strength | Planet            | 3 Influence, 3 fuel, 10 energy    | Move selected Strength at Speed 3, Range 9. Cloaked in transit and for 1 Turn after arrival. |      |
| Post Trade           | T4   | N/A        | Self           | Trade Board       | 5 Influence, Trade Offering       | Post a Trade Offering for 5 Turns with 15% Tax.                                              | Yes  |
| Post Trade           | T1   | N/A        | Self           | Trade Board       | 3 Influence, Trade Offering       | Post a Trade Offering for 10 Turns with 0% Tax.                                              |      |
| Bid on Trade         | T4   | N/A        | Self           | Open Trade        | 5 Influence, Bid Payment          | Bid at a 100% Rate on an Open Trade.                                                         | Yes  |
| Bid on Trade         | T1   | N/A        | Self           | Open Trade        | 3 Influence, Bid Payment          | Bid at a 150% Rate on an Open Trade.                                                         |      |
| Cancel Trade         | T4   | N/A        | Self           | Own Open Trade    | 1 Influence                       | Cancel the Trade. Refund its Trade Offering unless the Trade settles this Turn.              | Yes  |
| Post Contract        | T4   | N/A        | Self           | Contract Board    | Contract Reward                   | Post a Contract for 3 Turns with a 100% Reward Rate.                                         | Yes  |
| Post Contract        | T1   | N/A        | Self           | Contract Board    | Contract Reward                   | Post a Contract for 6 Turns with a 200% Reward Rate.                                         |      |
| Bid on Contract      | T4   | N/A        | Self           | Open Contract     | Action Costs                      | Bid to complete an Open Contract for 100% of your Bid Reward.                                | Yes  |
| Bid on Contract      | T1   | N/A        | Self           | Open Contract     | Action Costs                      | Bid to complete an Open Contract for 200% of your Bid Reward.                                |      |
| Cancel Contract      | T4   | N/A        | Self           | Own Open Contract | 1 Influence                       | Cancel the Contract. Refund its escrow unless the Contract settles this Turn.                | Yes  |
| Colonize Planet      | T4   | N/A        | Fleet          | Unclaimed Planet  | 25 Influence, 1 colony            | Move at Speed 1, Range 5. Colonize on arrival.                                               |      |
| Colonize Planet      | T1   | N/A        | Fleet          | Unclaimed Planet  | 25 Influence, 1 colony, 20 energy | Move at Speed 5, Range 5. Colonize on arrival. Develop at 200% for 10 Turns.                 |      |
| Build Infrastructure | T4   | N/A        | Self           | Owned Planet      | 10 Influence, Infrastructure Cost | Build Standard or lower Infrastructure.                                                      | Yes  |
| Build Infrastructure | T1   | N/A        | Self           | Owned Planet      | 10 Influence, Infrastructure Cost | Build Exceptional or lower Infrastructure.                                                   |      |
| Build Fleet          | T4   | N/A        | Self           | Owned Planet      | 10 Influence, 5 Metal             | Build a Fleet with Strength 5.                                                               | Yes  |
| Build Fleet          | T1   | N/A        | Self           | Owned Planet      | 10 Influence, 20 Metal            | Build a Fleet with Strength 20.                                                              |      |
| ...                  | ...  | ...        | ...            | ...               | ...                               | ...                                                                                          |      |

Note: Every Post Trade/Contract Action always comes with a Cancel Trade/Contract Action. It will not be explicitly written out in all documents to alleviate the text.

### Programs

Programs are big undertakings that span multiple Turns. They reward a lot of Legacy Points when they complete their Legacy Project.

| Program | Tier | Conditions | Source | Target | Costs | Effects |
| ------- | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...     | ...  | ...        | ...    | ...    | ...   | ...     |

### Detailed Mechanics

The Action tables use compact player-facing effect text. This text summarizes the Action Definition's composed Mechanics; the authoritative resolution boundary is [System 015-rules-engine](./015-rules-engine.md), and detailed mechanic rules live in the related system documents:

| Mechanic       | System                                        |
| -------------- | --------------------------------------------- |
| Trade          | [006-trade](./006-trade.md)                   |
| Contracts      | [007-contracts](./007-contracts.md)           |
| Colonization   | [008-planets](./008-planets.md)               |
| Infrastructure | [009-infrastructure](./009-infrastructure.md) |
| Fleets         | [010-fleets](./010-fleets.md)                 |
| Assault        | [011-combat](./011-combat.md)                 |
| Movement       | [012-movement](012-movement.md)               |
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
