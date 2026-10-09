import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatusSchema } from "shared/domain/games/GameStatus.ts"
import { z } from "zod"

/**
 * Public game summary, including the requesting account's membership.
 */
export type GameSummaryDto = z.infer<typeof GameSummaryDtoSchema>
export const GameSummaryDtoSchema = z.object({
  id: GameIdSchema,
  name: z.string(),
  hasJoined: z.boolean(),
  nbPlayers: z.number(),
  nbSeats: z.number(),
  status: GameStatusSchema,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
})
