# `resolveTurn` requirements

Next ID number: 0007

## Prefixes

| ID  | Stands for                    |
| --- | ----------------------------- |
| TR  | Turn Resolution, this module. |

## Requirements

| ID      | Requirement                                                                                                                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-0001 | When a turn has no eligible automatic effects, trips in progress or submitted orders, resolving it preserves the supplied game state.                                                                                                               |
| TR-0002 | Resolving an empty turn preserves the random generator state.                                                                                                                                                                                       |
| TR-0003 | When a turn resolves, each trade center present at turn start earns 10 credits for its planet’s owner, added once to that player’s global credit balance.                                                                                           |
| TR-0004 | When trade-center income is the only effect of a turn, resolution preserves the random generator state.                                                                                                                                             |
| TR-0005 | When the turn resolves, construct each still-submitted building once at its chosen hex and charge its owner once. It first provides its capability on the next turn.                                                                                |
| TR-0006 | When a turn resolves a submitted move, charge the full price once and travel the first segment during that turn. Each subsequent turn travels up to the departure speed on the same direct route and stops at the destination on the final segment. |
