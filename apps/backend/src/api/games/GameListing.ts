import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatusSchema } from "shared/domain/games/GameStatus.ts"
import { z } from "zod"

/**
 * Public game listing, including the requesting account's membership.
 */
export type GameListing = z.infer<typeof GameListingSchema>
export const GameListingSchema = z.object({
  id: GameIdSchema,
  name: z.string(),
  /**
   * Whether the user looking at the game listing has joined that game.
   * Always false when the user is anonymous.
   */
  hasJoined: z.boolean(),
  nbPlayers: z.number(),
  nbSeats: z.number(),
  status: GameStatusSchema,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
})
