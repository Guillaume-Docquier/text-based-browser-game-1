# `createGalaxy` requirements

Next ID number: 0009

## Prefixes

| ID   | Stands for                    |
| ---- | ----------------------------- |
| GC   | Galaxy Creation, this module. |
| PLNT | Planets.                      |
| SYS  | Star systems.                 |

## Requirements

| ID           | Requirement                                                                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GC-0001      | When the player list is empty, every planet in the returned galaxy is unowned.                                                                                                                                                                  |
| GC-0008      | With the default match settings, the returned procedural galaxy contains approximately 700 star systems and 3,000 planets.                                                                                                                      |
| GC-PLNT-0003 | When each supplied player can start in a separate system with a planet of area at least three, each player owns exactly one planet and all other planets are unowned.                                                                           |
| GC-PLNT-0006 | When a player receives a home planet, its area provides at least three usable spaces including the center.                                                                                                                                      |
| GC-SYS-0002  | Each system in the returned galaxy occupies a distinct one-light-year grid cell.                                                                                                                                                                |
| GC-SYS-0004  | Each system has x and y coordinates greater than or equal to zero and less than the configured galaxy diameter.                                                                                                                                 |
| GC-SYS-0005  | When a match starts with 1–16 players, each player’s home planet belongs to a different system from every other player’s home planet.                                                                                                           |
| GC-SYS-0007  | When home systems are assigned, each home occupies the nearest still-eligible system to its placement target, sampled at a uniform radius of 10–13 LY from the galaxy center and a uniform offset of −5° to +5° from its evenly spaced bearing. |
