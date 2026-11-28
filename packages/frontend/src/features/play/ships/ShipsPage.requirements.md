# `ShipsPage` requirements

Next ID number: 0004

## Prefixes

| ID   | Stands for               |
| ---- | ------------------------ |
| FLET | Fleet movement controls. |

## Requirements

| ID        | Requirement                                                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FLET-0001 | When a ship is stationed at a body at turn start, its owner can plan a direct move to any different star or planet, in the same or another system, from either the ship’s Move control and destination coordinates or the destination’s Move here control and ship list. |
| FLET-0002 | When a trip is previewed, the owner can distinguish the ship’s current location from its planned destination and see the same travel distance, departure speed, travel time and full credit cost from either entry point.                                                |
| FLET-0003 | When a ship is underway, its owner can inspect its current position, destination and progress. Its trip cannot be changed or recalled. A ship arriving at the end of N can first act at its destination on N+1 and stays there until ordered.                            |
