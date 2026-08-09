import { Result } from "@guillaume-docquier/tools-ts"
import type { Effect } from "#turn-processing/engine/effects/Effect.ts"
import type { EffectHandlingError } from "#turn-processing/engine/effects/handleEffect.ts"
import type { Mechanic } from "#turn-processing/engine/effects/Mechanic.ts"
import type { TurnState } from "#turn-processing/engine/TurnState.ts"

export const Income = {
  id: "income-mechanic",
  name: "Income",
  descriptionTemplate: "Gain P_RESOURCE_COUNT P_RESOURCE_TYPE",
  parameters: {
    P_RESOURCE_COUNT: "number",
    P_RESOURCE_TYPE: "resource-type",
  },
} as const satisfies Mechanic

export function incomeEffect(_turnState: TurnState, _effect: Effect<typeof Income>): Result<TurnState, EffectHandlingError> {
  // player X gains income
  return Result.Failure({ _tag: "bad arguments" })
}
