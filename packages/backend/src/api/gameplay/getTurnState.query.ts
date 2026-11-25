import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export type GetTurnStateQuery = z.infer<typeof GetTurnStateQuerySchema>
export const GetTurnStateQuerySchema = z.object({
  gameId: GameIdSchema,
})
