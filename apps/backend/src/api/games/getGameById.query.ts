import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export type GetGameByIdQuery = z.infer<typeof GetGameByIdQuerySchema>
export const GetGameByIdQuerySchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
})
