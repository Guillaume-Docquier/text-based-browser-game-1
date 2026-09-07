import { Assert, branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { AccountIdSchema } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { GameIdSchema, type GameId } from "#lib/db/games/GameId.ts"
import { GameStatus } from "#lib/db/games/GameStatus.ts"
import { PlayerColor } from "#lib/db/players/PlayerColor.ts"
import { PlayerIdSchema, type PlayerId } from "#lib/db/players/PlayerId.ts"
import { RulesetIdSchema } from "#lib/db/rulesets/RulesetId.ts"
import { couldNot, rollbackOnFailure, TransactionRollbackError } from "#lib/errors.ts"
import { UInt32 } from "#lib/UInt32.ts"
import type { LobbiesRepository, LobbyModel } from "./lobbies.repository.ts"

export const MAX_NB_SEATS = 16

export class LobbiesController {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly lobbiesRepository: LobbiesRepository

  public constructor({
    logger,
    createTransaction,
    lobbiesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    lobbiesRepository: LobbiesRepository
  }) {
    this.logger = logger.child({ scope: "lobbies-controller" })
    this.createTransaction = createTransaction
    this.lobbiesRepository = lobbiesRepository
  }

  public async createLobby(createLobbyDto: CreateLobbyDto): Promise<Result<CreatedLobbyDto, string>> {
    if (createLobbyDto.configuration.nbSeats > MAX_NB_SEATS) {
      return Result.Failure(`Games cannot have more than ${MAX_NB_SEATS} seats`)
    }

    if (createLobbyDto.configuration.mapGenerationSeed !== undefined && !UInt32.validate(createLobbyDto.configuration.mapGenerationSeed)) {
      return Result.Failure(`The seed must be an integer between 0 and ${UInt32.max}`)
    }

    const status = createLobbyDto.configuration.nbSeats <= 1 ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS
    const createLobbyResult = await this.lobbiesRepository.createLobby({
      ...createLobbyDto,
      mapGenerationSeed: createLobbyDto.configuration.mapGenerationSeed ?? UInt32.random(),
      status,
      creatorPlayerColor: PlayerColor.WHITE,
    })
    if (Result.isFailure(createLobbyResult)) {
      return createLobbyResult
    }

    return createLobbyResult
  }

  public async getCreationSettings(): Promise<Result<LobbyCreationSettingsDto, string>> {
    const lobbyCreationSettingsResult = await this.lobbiesRepository.getLobbyCreationSettings()
    if (Result.isFailure(lobbyCreationSettingsResult)) {
      return lobbyCreationSettingsResult
    }

    return Result.Success({
      maxNbSeats: MAX_NB_SEATS,
      ...lobbyCreationSettingsResult.value,
    })
  }

  public async getLobbyById({ gameId, playerId }: { gameId: GameId; playerId: PlayerId | undefined }): Promise<LobbyDto | undefined> {
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

  /**
   * This method is idempotent, joining an already joined game will return a success.
   */
  public async joinLobby({ gameId, accountId }: JoinLobbyDto): Promise<Result<JoinedLobbyDto, string>> {
    const playerId = branded<PlayerId>(accountId)
    const joinGameResult = await this.createTransaction(async (tx) => {
      const lobbyForJoin = await this.lobbiesRepository.getLobbyForJoin({ gameId }, tx)
      rollbackOnFailure(lobbyForJoin, "Failed to get lobby.")

      if (lobbyForJoin.value.players.find((player) => player.id === playerId) !== undefined) {
        // Already part of the game, return a success for idempotency
        return { playerId }
      }

      if (lobbyForJoin.value.status !== GameStatus.WAITING_FOR_PLAYERS) {
        throw new TransactionRollbackError("Cannot join lobby, it is full.")
      }

      const status =
        lobbyForJoin.value.players.length + 1 >= lobbyForJoin.value.nbSeats ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS

      const usedColors = new Set(lobbyForJoin.value.players.map((player) => player.color))
      const color = Object.values(PlayerColor).find((candidateColor) => !usedColors.has(candidateColor))
      Assert.isDefined(color)

      return await this.lobbiesRepository.joinLobby({ context: lobbyForJoin.value, playerId, color, status }, tx)
    })

    if (Result.isFailure(joinGameResult)) {
      this.logger.error("Could not join game lobby", { gameId, accountId, error: joinGameResult.error })
      return Result.Failure(couldNot("join game lobby"))
    }

    return joinGameResult
  }

  /**
   * This method is idempotent, leaving an already left game will return a success.
   */
  public async leaveLobby({ gameId, accountId }: LeaveLobbyDto): Promise<Result<LeftLobbyDto, string>> {
    const playerId = branded<PlayerId>(accountId)
    const leaveGameResult = await this.createTransaction(async (tx) => {
      const lobbyForLeave = await this.lobbiesRepository.getLobbyForLeave({ gameId }, tx)
      rollbackOnFailure(lobbyForLeave, "Failed to get lobby.")

      if (!lobbyForLeave.value.playerIds.includes(playerId)) {
        // Already not in the game, return a success for idempotency
        return
      }

      if (lobbyForLeave.value.status !== GameStatus.WAITING_FOR_PLAYERS && lobbyForLeave.value.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollbackError("Cannot leave a lobby that has started.")
      }

      if (lobbyForLeave.value.createdByAccountId === accountId) {
        throw new TransactionRollbackError("Cannot leave a lobby as its creator.")
      }

      await this.lobbiesRepository.leaveLobby({ context: lobbyForLeave.value, playerId, status: GameStatus.WAITING_FOR_PLAYERS }, tx)
    })

    if (Result.isFailure(leaveGameResult)) {
      this.logger.error("Could not leave game lobby", { gameId, accountId, error: leaveGameResult.error })
      return Result.Failure(couldNot("leave game lobby"))
    }

    return Result.Success(true)
  }
}

export function toLobbyDto({ lobbyModel, playerId }: { lobbyModel: LobbyModel; playerId: PlayerId | undefined }): LobbyDto {
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

export type CreateLobbyConfigurationDto = z.infer<typeof CreateLobbyConfigurationDtoSchema>
export const CreateLobbyConfigurationDtoSchema = z.object({
  name: z.string(),
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
  mapGenerationSeed: z.number().exactOptional(),
  rulesetId: RulesetIdSchema,
})

export type CreateLobbyDto = z.infer<typeof CreateLobbyDtoSchema>
export const CreateLobbyDtoSchema = z.object({
  createdByAccountId: AccountIdSchema,
  configuration: CreateLobbyConfigurationDtoSchema,
})

export type CreatedLobbyDto = z.infer<typeof CreatedLobbyDtoSchema>
export const CreatedLobbyDtoSchema = z.object({
  createdGameId: GameIdSchema,
})

export type JoinLobbyDto = z.infer<typeof JoinLobbyDtoSchema>
export const JoinLobbyDtoSchema = z.object({
  gameId: GameIdSchema,
  accountId: AccountIdSchema,
})

export type JoinedLobbyDto = z.infer<typeof JoinedLobbyDtoSchema>
export const JoinedLobbyDtoSchema = z.object({
  playerId: PlayerIdSchema,
})

export type LeaveLobbyDto = z.infer<typeof LeaveLobbyDtoSchema>
export const LeaveLobbyDtoSchema = z.object({
  gameId: GameIdSchema,
  accountId: AccountIdSchema,
})

export type LeftLobbyDto = z.infer<typeof LeftLobbyDtoSchema>
export const LeftLobbyDtoSchema = z.literal(true)

export type RulesetSummaryDto = z.infer<typeof RulesetSummaryDtoSchema>
const RulesetSummaryDtoSchema = z.object({
  id: RulesetIdSchema,
  name: z.string(),
  isDefault: z.boolean(),
})

export type LobbyCreationSettingsDto = z.infer<typeof LobbyCreationSettingsDtoSchema>
export const LobbyCreationSettingsDtoSchema = z.object({
  maxNbSeats: z.number(),
  rulesets: z.array(RulesetSummaryDtoSchema).readonly(),
})

export type LobbyPlayerDto = z.infer<typeof LobbyPlayerDtoSchema>
export const LobbyPlayerDtoSchema = z.object({
  id: PlayerIdSchema,
  alias: z.string().nullable(),
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
