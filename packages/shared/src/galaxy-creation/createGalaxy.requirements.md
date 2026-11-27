# `createGalaxy` requirements

Next ID number: 0005

## Prefixes

| ID  | Stands for                    |
| --- | ----------------------------- |
| GC  | Galaxy Creation, this module. |

## Requirements

| ID         | Requirement                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| GC-0001    | When the player list is empty, every planet in the returned galaxy is unowned.                                                     |
| GC-PL-0003 | When there are enough planets for the supplied players, each player owns exactly one planet and all remaining planets are unowned. |
| GC-SY-0002 | Each system in the returned galaxy occupies a distinct one-light-year grid cell.                                                   |
| GC-SY-0004 | Each system has x and y coordinates greater than or equal to zero and less than the configured galaxy diameter.                    |
