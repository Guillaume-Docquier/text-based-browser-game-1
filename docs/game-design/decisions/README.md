# Game Design Decision Records (GDDR) index

GDDRs capture durable decisions about the game's philosophy and mechanics. Statuses describe design decisions (`Accepted`, `Rejected`, `Deprecated`, or `Superseded`), not implementation progress.

## Accepted decisions

| GDDR                                                              | Summary                                                                                                                                                                                               | Use when                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [001-space-themed](001-space-themed.md)                           | The game has a space setting.                                                                                                                                                                         | You design the setting, lore, or player-facing text.                          |
| [002-bounded-game-length](002-bounded-game-length.md)             | Every game has a fixed duration known before it starts; a predefined public hard-win achievement may end it early.                                                                                    | You design game duration, victory conditions, or an early-ending achievement. |
| [003-turn-based](003-turn-based.md)                               | Players submit actions independently during fixed turn windows, with short play sessions and no timing advantage. Turns advance without missing players and resolve early when all players are ready. | You design turn pacing, action submission, readiness, or player coordination. |
| [004-competitive-collaboration](004-competitive-collaboration.md) | The game rewards collaboration while retaining individual scoring; collaboration should be the most viable option at some points in every game.                                                       | You design player incentives, collaboration, or scoring.                      |
