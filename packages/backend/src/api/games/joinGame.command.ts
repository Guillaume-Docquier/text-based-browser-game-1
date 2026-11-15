import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export type JoinGameCommand = z.infer<typeof JoinGameCommandSchema>
export const JoinGameCommandSchema = z.object({
  gameId: GameIdSchema,
})
