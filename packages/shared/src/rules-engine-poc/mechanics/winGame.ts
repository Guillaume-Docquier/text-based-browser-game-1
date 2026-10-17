import { Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { defineMechanic } from "../definitions/defineMechanic.ts"

/**
 * First victory in phase order wins; later attempts are completed but prevented.
 */
export const winGame = defineMechanic({
  targets: {},
  parameters: z.strictObject({}),
  phase: "victory",
  requirements: () => [],
  resolve: (_targets, _parameters, { state, actor }) => {
    if (state.winnerPlayerId !== undefined) {
      return Result.Success([{ status: "prevented", message: `Player ${state.winnerPlayerId} already won` }])
    }
    state.winnerPlayerId = actor.id
    return Result.Success([{ status: "resolved", message: "Won the game" }])
  },
})
