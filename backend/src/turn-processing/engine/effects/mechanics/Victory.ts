import { Result } from "@guillaume-docquier/tools-ts"
import type { Effect } from "#turn-processing/engine/effects/Effect.ts"
import type { EffectHandlingError } from "#turn-processing/engine/effects/handleEffect.ts"
import type { Mechanic } from "#turn-processing/engine/effects/Mechanic.ts"
import type { TurnState } from "#turn-processing/engine/TurnState.ts"

export const Victory = {
  id: "victory-mechanic",
  name: "Win the game",
  descriptionTemplate: "Win the game this turn",
  parameters: {},
} as const satisfies Mechanic

export function victoryEffect(_turnState: TurnState, _effect: Effect<typeof Victory>): Result<TurnState, EffectHandlingError> {
  // player X wins the game
  return Result.Failure({ _tag: "bad arguments" })
}
