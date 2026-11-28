# `moveShip` requirements

Next ID number: 0003

## Prefixes

| ID   | Stands for     |
| ---- | -------------- |
| MOVE | Move planning. |

## Requirements

| ID        | Requirement                                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOVE-0001 | When a player submits a move, reserve its full price from available turn-start credits and reserve only that ship’s action. Other ships can receive independent orders.                                                |
| MOVE-0002 | When the owner cancels a pending move during open planning, remove its route preview and release the full price and the ship’s action immediately. The ship stays at its origin and can be ordered again in that turn. |
