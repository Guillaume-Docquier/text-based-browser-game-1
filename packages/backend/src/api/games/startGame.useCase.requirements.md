# `startGame` requirements

Next ID number: 0004

## Prefixes

| ID   | Stands for   |
| ---- | ------------ |
| STRT | Start match. |

## Requirements

| ID        | Requirement                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STRT-0001 | When a match starts, each owned home planet has exactly one persisted command center on its center hex, and every unowned planet starts with an empty surface. |
| STRT-0002 | When a match starts, each participating player receives the configured starting balance of 100 credits, including the only player in a solo match.             |
| STRT-0003 | When a match starts, each home has one operating trade center on the first free surface hex alongside its command center.                                      |
