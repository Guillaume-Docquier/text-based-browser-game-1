# Turn Resolution

Turn Resolution computes Game State Deltas from the Game State and Player Actions. It is deterministic and free of side effects. `resolveTurn` computes credit income from trade centers and planet owners in the turn-start state. It charges each submitted construction order at its reserved price and returns its building placement alongside the net credit change. Completed buildings enter the next turn’s input. Each departing ship contributes its reserved trip price to the owner's exact decimal credit change. Departing and underway ships advance one segment along their stored route with the speed quoted at departure. On arrival, the ship update identifies its destination station. Resolution preserves its input and the random generator.

The backend [Turn Processing worker](../../../backend/src/turn-processing/ARCHITECTURE.md) owns scheduling and persistence.
