import type { Rng } from "@guillaume-docquier/tools-ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

/** Resolves an empty Turn without changing game state or consuming RNG state. */
export function resolveTurn(_state: TurnState, _rng: Rng): void {}
