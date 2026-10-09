import { AccountIdSchema } from "shared/domain/accounts/AccountId.ts"
import { AliasSchema } from "shared/domain/accounts/Alias.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { z } from "zod"
import { RulesetSummaryDtoSchema } from "./RulesetSummaryDto.ts"

/**
 * Player identity displayed in public game details and gameplay views.
 */
export type GamePlayerDto = z.infer<typeof GamePlayerDtoSchema>
export const GamePlayerDtoSchema = z.object({
  id: PlayerIdSchema,
  alias: AliasSchema,
  color: z.enum(PlayerColor),
})

/**
 * Public configuration with ruleset details instead of creation-only settings.
 */
export type GameConfigurationDetailsDto = z.infer<typeof GameConfigurationDetailsDtoSchema>
export const GameConfigurationDetailsDtoSchema = z.object({
  name: z.string(),
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
  ruleset: RulesetSummaryDtoSchema,
})

/**
 * Public game details and the operations available to the requesting player.
 */
export type GameDetailsDto = z.infer<typeof GameDetailsDtoSchema>
export const GameDetailsDtoSchema = z.object({
  id: GameIdSchema,
  winnerAccountId: AccountIdSchema.nullable(),
  configuration: GameConfigurationDetailsDtoSchema,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: GamePlayerDtoSchema,
  players: z.array(GamePlayerDtoSchema).readonly(),
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
