import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export type GameCreationConfirmation = z.infer<typeof GameCreationConfirmationSchema>
export const GameCreationConfirmationSchema = z.object({
  createdGameId: GameIdSchema,
})
