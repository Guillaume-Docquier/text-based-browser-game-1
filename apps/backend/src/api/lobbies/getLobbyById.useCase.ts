import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { AccountIdSchema } from "shared/domain/accounts/AccountId.ts"
import { AliasSchema } from "shared/domain/accounts/Alias.ts"
import { GameIdSchema, type GameId } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema, type PlayerId } from "shared/domain/players/PlayerId.ts"
import { z } from "zod"
import type { LobbiesRepository, LobbyModel } from "./lobbies.repository.ts"
import { RulesetSummaryDtoSchema } from "./RulesetSummaryDto.ts"

/**
 * Gets a lobby and the operations available to the requesting player.
 */
export class GetLobbyByIdUseCase {
  private readonly logger: Logger
  private readonly lobbiesRepository: LobbiesRepository

  public constructor({ logger, lobbiesRepository }: { logger: Logger; lobbiesRepository: LobbiesRepository }) {
    this.logger = logger.child({ scope: "get-lobby-by-id-use-case" })
    this.lobbiesRepository = lobbiesRepository
  }

  /**
   * Returns undefined when the lobby does not exist or cannot be loaded.
   */
  public async execute({ gameId, playerId }: { gameId: GameId; playerId: PlayerId | undefined }): Promise<LobbyDto | undefined> {
    const lobbyResult = await this.lobbiesRepository.getLobbyById({ gameId })
    if (Result.isFailure(lobbyResult)) {
      this.logger.error("Could not get game lobby, returning undefined", { gameId, playerId, error: lobbyResult.error })
      return undefined
    }

    const lobbyModel = lobbyResult.value
    if (lobbyModel === undefined) {
      return undefined
    }

    return toLobbyDto({ lobbyModel, playerId })
  }
}

function toLobbyDto({ lobbyModel, playerId }: { lobbyModel: LobbyModel; playerId: PlayerId | undefined }): LobbyDto {
  const status = lobbyModel.status

  const canJoin =
    playerId !== undefined && status === GameStatus.WAITING_FOR_PLAYERS && lobbyModel.players.every((player) => player.id !== playerId)

  const canLeave =
    playerId !== undefined &&
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    lobbyModel.creator.id !== playerId &&
    lobbyModel.players.some((player) => player.id === playerId)

  const canStart =
    playerId !== undefined &&
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    lobbyModel.creator.id === playerId

  const canOpen = status === GameStatus.IN_PROGRESS && lobbyModel.players.some((player) => player.id === playerId)

  return {
    ...lobbyModel,
    status,
    canJoin,
    canLeave,
    canStart,
    canOpen,
  }
}

export type LobbyPlayerDto = z.infer<typeof LobbyPlayerDtoSchema>
export const LobbyPlayerDtoSchema = z.object({
  id: PlayerIdSchema,
  alias: AliasSchema,
  color: z.enum(PlayerColor),
})

export type LobbyConfigurationDto = z.infer<typeof LobbyConfigurationDtoSchema>
export const LobbyConfigurationDtoSchema = z.object({
  name: z.string(),
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
  ruleset: RulesetSummaryDtoSchema,
})

export type LobbyDto = z.infer<typeof LobbyDtoSchema>
export const LobbyDtoSchema = z.object({
  id: GameIdSchema,
  winnerAccountId: AccountIdSchema.nullable(),
  configuration: LobbyConfigurationDtoSchema,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: LobbyPlayerDtoSchema,
  players: z.array(LobbyPlayerDtoSchema).readonly(),
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
