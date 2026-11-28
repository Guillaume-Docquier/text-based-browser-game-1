# `createGalaxy` requirements

Next ID number: 0005

## Prefixes

| ID   | Stands for                    |
| ---- | ----------------------------- |
| GC   | Galaxy Creation, this module. |
| PLNT | Planet related requirements.  |
| STAR | Star related requirements.    |

## Requirements

| ID           | Requirement                                                                    |
| ------------ | ------------------------------------------------------------------------------ |
| GC-0001      | When the player list is empty, every planet in the returned galaxy is unowned. |
| GC-PLNT-0002 | Each planet in the returned galaxy has a unique planet ID.                     |
| GC-PLNT-0004 | When one player starts a galaxy with at least one planet, they own one planet. |
| GC-STAR-0003 | Each star in the returned galaxy has a unique star ID.                         |
