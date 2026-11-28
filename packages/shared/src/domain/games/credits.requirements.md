# `credits` requirements

Next ID number: 0002

## Prefixes

| ID   | Stands for         |
| ---- | ------------------ |
| CRED | Credit arithmetic. |

## Requirements

| ID        | Requirement                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRED-0001 | When the sum of pending prices and a new price exactly equals available turn-start credits, accept the new order and leave zero available. When the sum exceeds those credits, reject it and preserve existing reservations. |
