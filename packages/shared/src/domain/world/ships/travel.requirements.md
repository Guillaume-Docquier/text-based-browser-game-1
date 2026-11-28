# `travel` requirements

Next ID number: 0003

## Prefixes

| ID   | Stands for   |
| ---- | ------------ |
| TRAV | Ship travel. |

## Requirements

| ID        | Requirement                                                                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TRAV-0001 | When a ship departs, its speed in LY per turn is the shared scale times the square root of thrust divided by total departure mass. Total departure mass is empty ship mass plus the mass of every cargo item aboard.                         |
| TRAV-0002 | When a trip is planned, its duration in turns is the ceiling of direct distance in LY divided by departure speed in LY per turn, and its price is one credit per actual LY. Preview and resolution use the same distance and departure load. |
