import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export type LeaveGameCommand = z.infer<typeof LeaveGameCommandSchema>
export const LeaveGameCommandSchema = z.object({
  gameId: GameIdSchema,
})
