# Turn Resolution

Turn Resolution computes Game State Deltas from the Game State and Player Actions. It is deterministic and free of side effects. `resolveTurn` computes credit income from trade centers and planet owners in the turn-start state. It returns per-player deltas and preserves its input and the random generator.

The backend [Turn Processing worker](../../../backend/src/turn-processing/ARCHITECTURE.md) owns scheduling and persistence.
