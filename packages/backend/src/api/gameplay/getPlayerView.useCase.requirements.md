# `getPlayerView` requirements

Next ID number: 0013

## Prefixes

| ID  | Stands for        |
| --- | ----------------- |
| PVR | Player view read. |

## Requirements

| ID       | Requirement                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PVR-0001 | When a player reads an observed planet, its visible metal production and remaining deposit come from the current or last observed state. The API omits the former metal, fertility, fuel, energy and maximum population fields.             |
| PVR-0002 | When an observed planet surface is read in a fresh session or after server restart, each current or last-observed building retains its saved identity, type, planet and occupied hex.                                                       |
| PVR-0003 | When a participant reads their player view, it returns that participant’s settled credit balance for the current game and keeps other participants’ credit balances private.                                                                |
| PVR-0004 | When the owner plans orders on turn N, only credits already available on turn N can fund them. Income earned when N resolves is available for orders on N+1.                                                                                |
| PVR-0005 | When a player submits a valid construction order, only that player sees the building type, exact destination hex and credit cost as a plan, distinguishable from resolved buildings.                                                        |
| PVR-0006 | When a ship’s base capabilities are read, its persisted ship type selects the shared in-memory template. A transport has thrust 64, empty mass 4 and four cargo slots.                                                                      |
| PVR-0007 | When another player can see a foreign ship in transit, their player view exposes its current sighting and omits its destination, route and remaining travel. The owner can still inspect the full trip.                                     |
| PVR-0008 | When a participant views a match, every star and planet remains identifiable by its public name, coordinates and location, regardless of scan coverage.                                                                                     |
| PVR-0009 | When a planet is in current vision, the player sees its resolved ownership, biome, size, area, metal production, remaining deposit and buildings. Store those observations for that player.                                                 |
| PVR-0010 | When a planet leaves current vision, show that player’s last recorded planet facts and buildings as previously observed. Before any observation those facts are unknown. When current coverage returns, refresh them to the resolved state. |
| PVR-0011 | When a foreign ship is outside current vision, omit that ship and its cargo from the player’s current data and all player-facing views. Previously seeing it creates no remembered ship or cargo record.                                    |
| PVR-0012 | When the Sun or a ship stationed at the Sun is viewed, its current resolved state is public. The Sun’s stockpile becomes public when stockpiles are introduced.                                                                             |
