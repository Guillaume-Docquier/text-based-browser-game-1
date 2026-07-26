# Game Design Decision Records (GDDR) index

This index summarizes the game's durable design decisions. Read the related record when a mechanic, its tradeoffs, or its implementation path matters to your work.

## Planned decisions

These decisions describe intended game philosophy and mechanics that are not yet implemented. They guide brainstorming, refinement, and future implementation work.

| GDDR                                                  | Summary                                                                                                | Use when                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [002-bounded-game-length](002-bounded-game-length.md) | Every game has an advertised end date with conclusive hard win conditions that can end the game early. | You design victory conditions, game duration, or an early-ending achievement. |

## Partially Implemented decisions

These decisions describe game design that the game partially follows. Some aspects have been implemented, but the full scope is not yet realized.

| GDDR                                | Summary                                                                                                                                                                                  | Use when                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [003-turn-based](003-turn-based.md) | Players submit orders during a fixed turn window, without requiring player-to-player acknowledgement nor large time investment. If all players are ready, the turn resolves immediately. | You design turn resolution, order submission, player availability. |

## Implemented decisions

These decisions describe game design that the game currently follows. They are the source of truth for the corresponding implemented mechanics, alongside the code.

| GDDR                      | Summary               | Use when                                                     |
| ------------------------- | --------------------- | ------------------------------------------------------------ |
| [001-space](001-space.md) | This is a space game. | You're touching the lore, player fantasy, copy or mechanics. |

## Deprecated / Superseded decisions

| GDDR | Summary | Use when |
| ---- | ------- | -------- |
