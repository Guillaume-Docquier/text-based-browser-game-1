import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PlayerSchema } from "shared/domain/players/Player.ts"
import { z } from "zod"

const GameConfigurationDetailsSchema = z.object({
  name: z.string(),
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
})

export type GameDetails = z.infer<typeof GameDetailsSchema>
export const GameDetailsSchema = z.object({
  id: GameIdSchema,
  configuration: GameConfigurationDetailsSchema,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: PlayerSchema,
  players: z.array(PlayerSchema).readonly(),
  status: z.enum(GameStatus),
  canJoin: z.boolean(),
  canLeave: z.boolean(),
  canStart: z.boolean(),
  canOpen: z.boolean(),
})
