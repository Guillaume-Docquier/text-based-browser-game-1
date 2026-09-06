# Game Design Decision Records (GDDR) index

This index summarizes the game's durable design decisions. Read the related record when a mechanic, its tradeoffs, or its implementation path matters to your work.

## Planned decisions

These decisions describe intended game philosophy and mechanics that are not yet implemented. They guide brainstorming, refinement, and future implementation work.

| GDDR                                                          | Summary                                                                                                       | Use when                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [002-bounded-game-length](002-bounded-game-length.md)         | Every game has a known fixed duration; a conclusive public hard-win achievement may end it early.             | You design victory conditions, game duration, or an early-ending achievement.              |
| [004-legacy-as-win-condition](004-legacy-as-win-condition.md) | The winner is the empire with the greatest Legacy, built through galactic impact rather than player conquest. | You design Legacy scoring, Legacy Projects, warfare, or victory conditions.                |
| [005-ideological-axes](005-ideological-axes.md)               | An empire's position on ideological axes determines its available actions and strategic specialization.       | You design ideological alignment, action availability, specialization, or strategic paths. |
| [007-asymmetric-play](007-asymmetric-play.md)                 | A chosen, changeable Political Regime modifies action costs and efficiency to create asymmetric play.         | You design Political Regimes, asymmetric strategies, or action balance.                    |

## Partially Implemented decisions

These decisions describe game design that the game partially follows. Some aspects have been implemented, but the full scope is not yet realized.

| GDDR                                                | Summary                                                                                          | Use when                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [006-card-like-actions](006-card-like-actions.md)   | Actions share a card-like model and form a per-turn pool constrained by prerequisites and costs. | You design actions, action pools, prerequisites, costs, tiers, or the action codex. |
| [008-thematic-resources](008-thematic-resources.md) | Multiple thematic resources create economic specialization, scarcity, and inter-empire exchange. | You design resources, production, scarcity, trade, contracts, or specialization.    |

## Implemented decisions

These decisions describe game design that the game currently follows. They are the source of truth for the corresponding implemented mechanics, alongside the code.

| GDDR                                                                                        | Summary                                                                                                                                       | Use when                                                                         |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [001-space](001-space.md)                                                                   | This is a space game.                                                                                                                         | You're touching the lore, player fantasy, copy or mechanics.                     |
| [003-turn-based](003-turn-based.md)                                                         | Players submit Actions during a fixed Turn window. Public, reversible readiness locks their choices; unanimous readiness ends the Turn early. | You design Turn Resolution, Action submission, or readiness.                     |
| [009-deterministic-data-driven-rules-engine](009-deterministic-data-driven-rules-engine.md) | Actions declaratively compose reusable Mechanics and resolve deterministically through engine-owned ordered Phases.                           | You design Mechanics, Effects, Action Definitions, Rulesets, or Turn Resolution. |

## Deprecated / Superseded decisions

| GDDR | Summary | Use when |
| ---- | ------- | -------- |
