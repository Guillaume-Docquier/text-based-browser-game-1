# Turn Resolution

Turn Resolution computes Game State Deltas from the Game State and Player Actions. It is deterministic and free of side effects. Currently, `resolveTurn` handles empty Turns and leaves both the game state and the random generator unchanged.

The backend [Turn Processing worker](../../../backend/src/turn-processing/ARCHITECTURE.md) owns scheduling and persistence.
