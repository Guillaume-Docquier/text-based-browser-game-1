import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PlayerSchema } from "shared/domain/players/Player.ts"
import { z } from "zod"

const GameConfigurationDetailsSchema = z.object({
  name: z.string(),
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
})

/**
 * Public game details and the operations available to the requesting player.
 */
export type GameDetails = z.infer<typeof GameDetailsSchema>
export const GameDetailsSchema = z.object({
  id: GameIdSchema,
  configuration: GameConfigurationDetailsSchema,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: PlayerSchema,
  /**
   * The players in the game, including the creator
   */
  players: z.array(PlayerSchema).readonly(),
  status: z.enum(GameStatus),
  /**
   * Whether the current player can join the game.
   */
  canJoin: z.boolean(),
  /**
   * Whether the current player can leave the game.
   */
  canLeave: z.boolean(),
  /**
   * Whether the current player can start the game.
   */
  canStart: z.boolean(),
  /**
   * Whether the current player can open the started game.
   */
  canOpen: z.boolean(),
})
