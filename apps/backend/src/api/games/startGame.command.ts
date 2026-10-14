import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export type StartGameCommand = z.infer<typeof StartGameCommandSchema>
export const StartGameCommandSchema = z.object({
  gameId: GameIdSchema,
})
