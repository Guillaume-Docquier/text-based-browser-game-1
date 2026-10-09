import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatusSchema } from "shared/domain/games/GameStatus.ts"
import { z } from "zod"

/**
 * Public game listing, including the requesting account's membership.
 */
export type GameListingDto = z.infer<typeof GameListingDtoSchema>
export const GameListingDtoSchema = z.object({
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
