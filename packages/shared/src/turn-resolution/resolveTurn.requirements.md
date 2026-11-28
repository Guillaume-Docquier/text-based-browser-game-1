# `resolveTurn` requirements

Next ID number: 0005

## Prefixes

| ID  | Stands for                    |
| --- | ----------------------------- |
| TR  | Turn Resolution, this module. |

## Requirements

| ID      | Requirement                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-0001 | When a turn has no eligible automatic effects, trips in progress or submitted orders, resolving it preserves the supplied game state.                     |
| TR-0002 | Resolving an empty turn preserves the random generator state.                                                                                             |
| TR-0003 | When a turn resolves, each trade center present at turn start earns 10 credits for its planet’s owner, added once to that player’s global credit balance. |
| TR-0004 | When trade-center income is the only effect of a turn, resolution preserves the random generator state.                                                   |
