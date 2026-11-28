# `schema` requirements

Next ID number: 0004

## Prefixes

| ID  | Stands for       |
| --- | ---------------- |
| DB  | Database schema. |

## Requirements

| ID      | Requirement                                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-0001 | When buildings are stored on a planet, each hex holds at most one building and the planet holds at most one command center.                                                                              |
| DB-0002 | When an existing match gains credit balances, each participant missing a balance receives the starting grant once. Reopening the match or restarting the backend preserves the stored amount.            |
| DB-0003 | When a match predating ships is upgraded, create the missing starting transport once for each participant with a saved home. Later reads and restarts retain the same ship identity, owner and location. |
