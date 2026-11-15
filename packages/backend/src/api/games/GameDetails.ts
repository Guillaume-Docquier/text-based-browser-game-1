import { AccountIdSchema } from "shared/domain/accounts/AccountId.ts"
import { AliasSchema } from "shared/domain/accounts/Alias.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PlayerColorSchema } from "shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { z } from "zod"
import { RulesetSummarySchema } from "./RulesetSummary.ts"

export type GameDetailsPlayer = z.infer<typeof GameDetailsPlayerSchema>
export const GameDetailsPlayerSchema = z.object({
  id: PlayerIdSchema,
  alias: AliasSchema,
  color: PlayerColorSchema,
})

const GameConfigurationDetailsSchema = z.object({
  name: z.string(),
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
  ruleset: RulesetSummarySchema,
})

/**
 * Public game details and the operations available to the requesting player.
 */
export type GameDetails = z.infer<typeof GameDetailsSchema>
export const GameDetailsSchema = z.object({
  id: GameIdSchema,
  winnerAccountId: AccountIdSchema.nullable(),
  configuration: GameConfigurationDetailsSchema,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: GameDetailsPlayerSchema,
  /**
   * The players in the game, including the creator
   */
  players: z.array(GameDetailsPlayerSchema).readonly(),
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
