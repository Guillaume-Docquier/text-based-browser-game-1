import type { Result } from "@guillaume-docquier/tools-ts"
import type { Effect } from "#turn-processing/engine/effects/Effect.ts"
import { incomeEffect, Income } from "#turn-processing/engine/effects/mechanics/Income.ts"
import { Victory, victoryEffect } from "#turn-processing/engine/effects/mechanics/Victory.ts"
import type { TurnState } from "#turn-processing/engine/TurnState.ts"

export type EffectHandlingError = {
  // To do properly
  _tag: "bad arguments"
}

export function handleEffect(turnState: TurnState, effect: Effect): Result<TurnState, EffectHandlingError> {
  switch (effect.mechanicId) {
    case Income.id:
      return incomeEffect(turnState, effect)
    case Victory.id:
      return victoryEffect(turnState, effect)
  }
}
