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

- They have a type
- They have a tier
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

| Agenda | Type | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...  | ...        | ...    | ...    | ...   | ...     |

### Directives

Directives are targeted Actions, generally affecting a Planet or a Unit, that have little to no impact on the player Ideologies. They aim to have concrete, immediate effects.

| Directive | Type | Tier | Conditions | Source | Target | Costs | Effects |
| --------- | ---- | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...       | ...  | ...  | ...        | ...    | ...    | ...   | ...     |

### Legacies

Legacies are big undertakings that span multiple turns. They reward a lot of Legacy points when they complete their Legacy Project.

| Legacy | Type | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...  | ...        | ...    | ...    | ...   | ...     |

## Potential Flaws

Players might have access to too many actions at the same time, making it overwhelming and hard to choose which actions should be played.
