# `getPlayerView` requirements

Next ID number: 0004

## Prefixes

| ID  | Stands for        |
| --- | ----------------- |
| PVR | Player view read. |

## Requirements

| ID       | Requirement                                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PVR-0001 | When a player reads a saved planet, the API returns its stored metal production and remaining deposit and omits the former metal, fertility, fuel, energy and maximum population fields. |
| PVR-0002 | When a planet surface is read in a fresh session or after server restart, each building retains its identity, type, planet and occupied hex.                                             |
| PVR-0003 | When a participant reads their player view, it returns that participant’s settled credit balance for the current game and keeps other participants’ credit balances private.             |
