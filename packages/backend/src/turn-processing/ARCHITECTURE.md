# Turn processing

Turn Processing is the process via which turns that must be resolved are found and sent for resolution at the right time. This is different from Turn Resolution because it is game agnostic.

The backend worker in `packages/backend/src/turn-processing` owns Turn scheduling, persistence, and orchestration. The shared [Turn Resolution](../../../shared/src/turn-resolution/ARCHITECTURE.md) code in `packages/shared/src/turn-resolution` owns deterministic game state resolution. This separation follows [ADR 011](../../../../docs/architecture/decisions/011-turn-processing-in-worker-thread.md) and [ADR 007](../../../../docs/architecture/decisions/007-code-sharing.md).

The turn processing pipeline doesn't know much about how turns are resolved. It only knows what data to supply to the `resolveTurn` function and how to handle the state that comes out.

## Current orchestration

1. `TurnProcessor` works on 2 tables: `turnsTable` and `turnsProcessingTable`. When a turn is created, a row is inserted in both tables immediately.
1. `TurnProcessor` promotes closed Turns rows from `COLLECTING_ACTIONS` to `AWAITING_PROCESSING`. Turns can also be closed and their scheduling updated by unanimous Readiness via the `packages/backend/src/api/`.
1. Through `TurnsRepository`, the worker claims a turnsProcessing row by locking the row, moves the Turns row to `PROCESSING`, and loads the game state and random-generator state.
1. The worker then unlocks the turnsProcessing row after setting the processing startDate, which prevents other workers from processing it.
1. The worker calls `resolveTurn` with the game state and the restored random generator. Empty turns make no changes to either.
1. In one transaction, the worker marks the Turn `COMPLETED`, applies the returned credit deltas, resets Readiness, and creates the next Turn and its queue row. It carries the random-generator state forward.

The diagram shows the successful resolution path. Failure-mode policy reconciliation remains tracked in [#433](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/433).

```mermaid
sequenceDiagram
        participant P3 as TurnProcessor
        participant P1@{ "type": "database" } as TurnsRepository
        participant P2@{ "type": "collections" } as resolveTurn
        loop every worker check
          P3->>P1: promote expired collecting Turns
          P3->>P1: claim queued AWAITING_PROCESSING Turn
          alt Turn found
            P1->>P3: game state and random-generator state
            P3->>P2: resolve Turn
            P2->>P3: per-player credit income
            P3->>P1: complete Turn, settle credits, reset Readiness, and queue next Turn with RNG state
          end
        end
```
