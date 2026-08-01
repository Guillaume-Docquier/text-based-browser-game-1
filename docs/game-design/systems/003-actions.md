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

The costs are spent only when the turn ends, but the player will not be allowed to play Actions that would overspend. A visual indicator will let the user know how much of each resource they have in total, and how much they will have after paying the costs of all their Actions.

### Agendas

Agendas are broad Actions, generally Empire or Planet wide, that have a noticeable impact on the player Ideologies. They aim to steer how the Empire as a whole functions over multiple turns.

| Agenda | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...        | ...    | ...    | ...   | ...     |

### Directives

Directives are targeted Actions, generally affecting a Planet or a Unit, that have little to no impact on the player Ideologies. They aim to have concrete, immediate effects.

| Directive            | Tier        | Conditions | Source | Target           | Costs                             | Effects                                                                                                        |
| -------------------- | ----------- | ---------- | ------ | ---------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Attack Move          | Standard    | N/A        | Fleet  | Planet           | 5 Influence, 1 fuel               | Travel at Speed 1, Range 5. Assault on arrival.                                                                |
| Attack Move          | Exceptional | N/A        | Fleet  | Planet           | 5 Influence, 5 fuel, 5 energy     | Travel at Speed 5, Range 25. Surprise Assault on arrival.                                                      |
| Stealth Move         | Standard    | N/A        | Fleet  | Planet           | 3 Influence, 1 fuel, 5 energy     | Travel at Speed 1, Range 3. Cloaked in transit.                                                                |
| Stealth Move         | Exceptional | N/A        | Fleet  | Planet           | 3 Influence, 3 fuel, 10 energy    | Travel at Speed 3, Range 9. Cloaked in transit and for 1 turn after arrival.                                   |
| Post Trade           | Standard    | N/A        | Self   | Trade Board      | 5 Influence, Trade Offering       | Post a trade for 5 turns on the trade board with a 15% tax.                                                    |
| Post Trade           | Exceptional | N/A        | Self   | Trade Board      | 3 Influence, Trade Offering       | Post a trade for 10 turns on the trade board with a 0% tax.                                                    |
| Bid on Trade         | Standard    | N/A        | Self   | Open Trade       | 5 Influence, Offered Bid          | Bid on an open trade at a 100% rate.                                                                           |
| Bid on Trade         | Exceptional | N/A        | Self   | Open Trade       | 3 Influence, Offered Bid          | Bid on an open trade at a 150% rate.                                                                           |
| Post Contract        | Standard    | N/A        | Self   | Contract Board   | 0 Influence, Offered Reward       | Post a contract for 3 turns on the contracts board. Contractor gains 100% of the offered reward.               |
| Post Contract        | Exceptional | N/A        | Self   | Contract Board   | 0 Influence, Offered Reward       | Post a contract for 6 turns on the contracts board. Contractor gains 200% of the offered reward.               |
| Bid on Contract      | Standard    | N/A        | Self   | Open Contract    | 0 Influence                       | Bid on an open contract. You earn 100% of your bid.                                                            |
| Bid on Contract      | Exceptional | N/A        | Self   | Open Contract    | 0 Influence                       | Bid on an open contract. You earn 200% of your bid.                                                            |
| Colonize Planet      | Standard    | N/A        | Fleet  | Unclaimed Planet | 25 Influence, 1 colony            | Travel at Speed 1, Range 5. Colonize on arrival.                                                               |
| Colonize Planet      | Exceptional | N/A        | Fleet  | Unclaimed Planet | 25 Influence, 1 colony, 20 energy | Travel at Speed 5, Range 5. Colonize on arrival. The planet develops at 200% efficiency for the next 10 turns. |
| Build Infrastructure | Standard    | N/A        | Self   | Planet           | 10 Influence, Infrastructure cost | Build basic infrastructure                                                                                     |
| Build Infrastructure | Exceptional | N/A        | Self   | Planet           | 10 Influence, Infrastructure cost | Build exceptional infrastructure                                                                               |
| Build Fleet          | Standard    | N/A        | Self   | Planet           | 10 Influence, 5 Metal             | Build a fleet of strength 5                                                                                    |
| Build Fleet          | Exceptional | N/A        | Self   | Planet           | 10 Influence, 20 Metal            | Build a fleet of strength 20                                                                                   |
| ...                  | ...         | ...        | ...    | ...              | ...                               | ...                                                                                                            |

### Legacies

Legacies are big undertakings that span multiple turns. They reward a lot of Legacy points when they complete their Legacy Project.

| Legacy | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...        | ...    | ...    | ...   | ...     |

### Mechanics and Keywords

Action effects use keywords and defined game terms as shorthand for the complete rules below.

#### Travel

**Travel at Speed X, Range Y** means the action may target a Planet whose travel distance from the fleet is no greater than Y light-years. The fleet travels toward that Planet by up to X light-years each turn until it arrives.

- **Speed X** is the maximum number of light-years the fleet travels per turn.
- **Range Y** is the maximum travel distance allowed between the fleet and the target Planet. A Planet beyond that distance is not a valid target.
- A fleet is **in transit** from the moment it departs until immediately before it arrives.
- A fleet **arrives** when it reaches the target Planet. It is no longer in transit before any arrival effects resolve.

#### Assault

A fleet with **Assault on arrival** will attack all fleets present at the destination.

#### Surprise Assault

A fleet with **Surprise Assault on arrival** will attack all fleets present at the destination, dealing a first round of damage before the enemy can retaliate.

#### Cloaked

A **Cloaked** fleet and all information about it are hidden from Enemy players. Enemy players cannot target it.

An effect that keeps a fleet Cloaked for 1 turn after arrival ends at the end of the first turn after the fleet arrives.

## Potential Flaws

Players might have access to too many actions at the same time, making it overwhelming and hard to choose which actions should be played.
