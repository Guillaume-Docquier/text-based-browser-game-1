# Political Regime

## Status

Not Implemented

## Purpose

Political Regime creates asymmetric play by defining an empire's fixed Influence budget and broad modifiers for Agendas and Directives.

Supports:

- [GDDR 006-card-like-actions](../decisions/006-card-like-actions.md)
- [GDDR 007-asymmetric-play](../decisions/007-asymmetric-play.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 004-ideological-alignment](./004-ideological-alignment.md)
- [System 014-resources](./014-resources.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept                  | Definition                                                           |
| ------------------------ | -------------------------------------------------------------------- |
| Political Regime         | A permanent empire profile chosen at the start of a game.            |
| Influence Income         | The fixed amount of Influence available to the Empire each Turn.     |
| Agenda Cost Modifier     | A multiplier applied to an Agenda's Influence cost.                  |
| Directive Cost Modifier  | A multiplier applied to a Directive's Influence cost.                |
| Alignment Shift Modifier | A multiplier applied to any Action's numerical alignment shift.      |
| Numeric Effect Modifier  | A multiplier applied to numerical effects of Agendas and Directives. |

## Rules

Each player chooses a Political Regime when the game starts. The choice is permanent for that game.

At the beginning of every Turn, an empire's available Influence resets to exactly its Regime's Influence Income. Unspent Influence does not carry over, and an empire cannot have more Influence than its Income.

Political Regimes modify only Influence costs, alignment shifts, and numerical Agenda or Directive effects. They do not modify resource costs. They do not affect Legacy Projects, Legacy scoring, or win conditions.

Modified Influence costs always round up to a whole number. Modified numerical effects always round to the nearest whole number.

| Regime    | Influence Income | Agenda Cost | Directive Cost | Alignment Shift | Numeric Effects |
| --------- | ---------------: | ----------: | -------------: | --------------: | --------------: |
| Democracy |              100 |         75% |           125% |             75% |            100% |
| Monarchy  |              100 |        125% |            75% |            125% |            100% |

## Potential Flaws

- A permanent choice can leave a player dissatisfied if its advantages are unclear before the game begins.
- Broad modifiers can create a dominant Regime if Agenda and Directive value is not balanced.
- Rounding can make small Influence costs disproportionately different between Regimes.
