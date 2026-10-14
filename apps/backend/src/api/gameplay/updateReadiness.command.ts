import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export type UpdateReadinessCommand = z.infer<typeof UpdateReadinessCommandSchema>
export const UpdateReadinessCommandSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  turn: z.coerce.number(),
  isReady: z.boolean(),
})
