# `construction` requirements

Next ID number: 0005

## Prefixes

| ID  | Stands for             |
| --- | ---------------------- |
| CON | Construction planning. |

## Requirements

| ID       | Requirement                                                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CON-0001 | When construction is planned, reserve the command center, the selected hex and the full price against the owner’s available turn-start balance. Other pending orders cannot commit those resources again. |
| CON-0002 | When a paid order would exceed a player’s available turn-start credits after other reservations, reject it without altering their existing plans.                                                         |
| CON-0003 | When a player cancels their construction order before resolution starts, clear only its preview and release its hex, command center and full price for immediate reuse that turn.                         |
| CON-0004 | When a player marks or unmarks readiness, follow the existing turn-closing rules. A canceled order has no effect, and an order cannot be changed once resolution has begun.                               |
