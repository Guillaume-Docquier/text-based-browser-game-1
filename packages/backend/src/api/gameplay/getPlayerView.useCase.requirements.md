# `getPlayerView` requirements

Next ID number: 0007

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
| PVR-0004 | When the owner plans orders on turn N, only credits already available on turn N can fund them. Income earned when N resolves is available for orders on N+1.                             |
| PVR-0005 | When a player submits a valid construction order, only that player sees the building type, exact destination hex and credit cost as a plan, distinguishable from resolved buildings.     |
| PVR-0006 | When a ship’s base capabilities are read, its persisted ship type selects the shared in-memory template. A transport has thrust 64, empty mass 4 and four cargo slots.                   |
