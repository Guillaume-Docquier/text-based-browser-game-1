import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export type GetPlayerViewQuery = z.infer<typeof GetPlayerViewQuerySchema>
export const GetPlayerViewQuerySchema = z.object({
  gameId: GameIdSchema,
})
