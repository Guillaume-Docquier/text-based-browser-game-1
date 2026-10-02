import { Assert, Datetime, type Logger, mulberry32Prng, Result, Rng, Timer } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { computeAvailableActions } from "shared/action-submission/computeAvailableActions.ts"
import { getUncommittedResources } from "shared/action-submission/getUncommittedResources.ts"
import { validateCosts } from "shared/action-submission/validation/costs/validateCosts.ts"
import { ActionIdSchema } from "shared/domain/actions/ActionId.ts"
import { SelectedTargetsSchema } from "shared/domain/actions/SelectedTargets.ts"
import { type GameId, GameIdSchema } from "shared/domain/game/GameId.ts"
import { GameStatus } from "shared/domain/game/GameStatus.ts"
import { type AccountId, AccountIdSchema } from "shared/domain/identity/AccountId.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { type PlayerId, PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import type { Resources } from "shared/domain/resources/Resources.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionIdSchema } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { FleetIdSchema } from "shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema } from "shared/domain/world/fleets/FleetName.ts"
import { PlanetBiome } from "shared/domain/world/planets/PlanetBiome.ts"
import { PlanetCoordinatesSchema } from "shared/domain/world/planets/PlanetCoordinates.ts"
import { PlanetIdSchema } from "shared/domain/world/planets/PlanetId.ts"
import { PlanetNameSchema } from "shared/domain/world/planets/PlanetName.ts"
import { PlanetSize } from "shared/domain/world/planets/PlanetSize.ts"
import { StarCoordinatesSchema } from "shared/domain/world/stars/StarCoordinates.ts"
import { StarIdSchema } from "shared/domain/world/stars/StarId.ts"
import { createGalaxy } from "shared/galaxy-creation/createGalaxy.ts"
import { GalaxyCreationSettings } from "shared/galaxy-creation/GalaxyCreationSettings.ts"
import { z } from "zod"
import { type ResourceAmountsDto, ResourcesDtoSchema } from "#api/gameplay/ResourcesDto.ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { couldNot } from "#lib/errors.ts"
import { UInt32 } from "#lib/UInt32.ts"
import { createTurnState } from "./createTurnState.ts"
import type { GameplayRepository, PlayerViewModel } from "./gameplay.repository.ts"

export class GameplayController {
  private readonly logger: Logger
  private readonly clock: Clock
  private readonly gameplayRepository: GameplayRepository
  private readonly createTransaction: CreateTransaction

  public constructor({
    logger,
    clock,
    gameplayRepository,
    createTransaction,
  }: {
    logger: Logger
    clock: Clock
    gameplayRepository: GameplayRepository
    createTransaction: CreateTransaction
  }) {
    this.logger = logger.child({ scope: "gameplay-controller" })
    this.clock = clock
    this.gameplayRepository = gameplayRepository
    this.createTransaction = createTransaction
  }

  public async startGame({ gameId, requesterAccountId }: StartGameDto): Promise<Result<StartedGameDto, string>> {
    const startGameResult = await this.createTransaction(async (tx) => {
      const gameForStart = await this.gameplayRepository.getGameForStart({ gameId }, tx)

      if (gameForStart.createdByAccountId !== requesterAccountId) {
        throw new TransactionRollbackError("Only the game creator can start it.")
      }

      if (gameForStart.status !== GameStatus.WAITING_FOR_PLAYERS && gameForStart.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollbackError("The game cannot start in its current status.", {
          cause: { status: gameForStart.status, expected: [GameStatus.WAITING_FOR_PLAYERS, GameStatus.READY_TO_START] },
        })
      }

      const startedAt = this.clock.now()
      const turnEndsAt = Datetime.increment({ date: startedAt, time: gameForStart.turnInterval })

      const startingResources = Object.values(ResourceType).map((resourceType) => ({
        resourceType,
        amount: gameForStart.ruleset.startingResources[resourceType],
      }))
      const playerResources = gameForStart.playerIds.flatMap((playerId) => startingResources.map((resource) => ({ playerId, ...resource })))

      const startTime = Timer.start()
      const rng = Rng.create(mulberry32Prng(gameForStart.mapGenerationSeed))
      const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: gameForStart.playerIds, rng })
      this.logger.debug("Generated galaxy", { elapsedTime: Timer.since(startTime) })

      await this.gameplayRepository.startGame(
        {
          context: gameForStart,
          status: GameStatus.IN_PROGRESS,
          startedAt,
          turnEndsAt,
          // Do not reuse the map generation seed, use a "secret" one, otherwise the game can be controlled by the creator
          rngState: { generatorState: UInt32.random(), spareNormal: null },
          playerResources,
          availableActions: computeAvailableActions({
            playerIds: gameForStart.playerIds,
            ruleset: gameForStart.ruleset,
          }),
          galaxy,
        },
        tx,
      )

      return { turnEndsAt }
    })

    if (Result.isFailure(startGameResult)) {
      this.logger.error("Could not start game", { gameId, requesterAccountId, error: startGameResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return startGameResult
  }

  public async getPlayerId({ gameId, accountId }: { gameId: GameId; accountId: AccountId }): Promise<Result<PlayerId | undefined, string>> {
    return await this.gameplayRepository.getPlayerId({ gameId, accountId })
  }

  public async getPlayerView({ gameId, playerId }: GetPlayerViewDto): Promise<Result<PlayerViewDto | undefined, string>> {
    const playerViewResult = await this.gameplayRepository.getPlayerView({ gameId, playerId })
    if (Result.isFailure(playerViewResult)) {
      return playerViewResult
    }

    if (playerViewResult.value === undefined) {
      // This is not a Failure because everything went right.
      // It's a bad request, but not unexpected from here that no player view is found.
      return Result.Success(undefined)
    }

    return Result.Success(toPlayerViewDto(playerViewResult.value))
  }

  public async updateReadiness({ gameId, turn, playerId, isReady }: UpdateReadinessDto): Promise<Result<void, string>> {
    const result = await this.createTransaction(async (tx) => {
      const context = await this.gameplayRepository.getReadinessForUpdate({ gameId, playerId, turn }, tx)

      await this.gameplayRepository.updateReadiness({ context, isReady }, tx)

      const allPlayersAreReady = context.players.every((player) => (player.id === playerId ? isReady : player.isReady))
      if (allPlayersAreReady) {
        await this.gameplayRepository.closeTurn({ context, closedAt: this.clock.now() }, tx)
      }
    })

    if (Result.isFailure(result)) {
      this.logger.error("Could not update readiness", { gameId, turn, playerId, error: result.error })
      return Result.Failure(result.error.message)
    }

    return Result.Success(undefined)
  }
}

function toPlayerViewDto(playerViewModel: PlayerViewModel): PlayerViewDto {
  const uncommittedResources =
    playerViewModel.turnStatus === TurnStatus.COMPLETED
      ? playerViewModel.resources // When the turn is completed, at action costs have been spent already, so we don't need to compute commitments
      : getUncommittedResources({
          resources: playerViewModel.resources,
          actions: playerViewModel.actions.filter((action) => action.selectedTargets !== null),
          ruleset: playerViewModel.ruleset,
        })

  return {
    gameId: playerViewModel.gameId,
    player: playerViewModel.player,
    opponents: playerViewModel.opponents,
    galaxy: {
      systems: playerViewModel.galaxy.systems.map(({ star, planets }) => ({
        star,
        planets: [...planets],
      })),
    },
    fleets: playerViewModel.fleets,
    turn: playerViewModel.turn,
    turnStatus: playerViewModel.turnStatus,
    turnEndsAt: playerViewModel.turnEndsAt,
    resources: toResourcesDto(playerViewModel.resources, uncommittedResources),
    ruleset: playerViewModel.ruleset,
    actions: toActionDtos(playerViewModel, uncommittedResources),
  }
}

function toResourcesDto(totalResources: Readonly<Resources>, uncommittedResources: Readonly<Resources>): PlayerViewDto["resources"] {
  // string instead of ResourceType to satisfy TypeScript. Strange that it works, maybe even dangerous, but okay
  return Object.entries(totalResources).reduce<Record<string, ResourceAmountsDto>>((resourcesDto, [resourceType, total]) => {
    resourcesDto[resourceType] = {
      total,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.entries widens the key type.
      uncommitted: uncommittedResources[resourceType as ResourceType] ?? 0,
    }
    return resourcesDto
  }, {})
}

function toActionDtos(playerViewModel: PlayerViewModel, uncommittedResources: Resources): ActionDto[] {
  const turnState = createTurnState({
    gameId: playerViewModel.gameId,
    turn: playerViewModel.turn,
    playerId: playerViewModel.player.id,
    resources: uncommittedResources,
    submittedActions: [],
    planets: [], // doesn't matter for cost validation
    fleets: [], // doesn't matter for cost validation
  })

  return playerViewModel.actions.map((action) => {
    if (action.selectedTargets !== null) {
      // If the action is submitted already (selected targets are defined), then the action is affordable because it's been committed already
      return {
        ...action,
        canAfford: true,
      }
    }

    const affordabilityResult = validateCosts(
      [
        {
          ...action,
          playerId: playerViewModel.player.id,
          selectedTargets: {},
        },
      ],
      playerViewModel.ruleset,
      turnState,
    )
    Assert.isSuccess(affordabilityResult)

    return {
      ...action,
      canAfford: affordabilityResult.value.length === 0,
    }
  })
}

export type StartGameDto = z.infer<typeof StartGameDtoSchema>
export const StartGameDtoSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  requesterAccountId: AccountIdSchema,
})

export type StartedGameDto = z.infer<typeof StartedGameDtoSchema>
export const StartedGameDtoSchema = z.object({
  turnEndsAt: z.date(),
})

export type GetPlayerViewDto = z.infer<typeof GetPlayerViewDtoSchema>
export const GetPlayerViewDtoSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  playerId: PlayerIdSchema,
})

export type PlayerViewPlayerDto = z.infer<typeof PlayerViewPlayerDtoSchema>
export const PlayerViewPlayerDtoSchema = z.object({
  id: PlayerIdSchema,
  color: z.enum(PlayerColor),
  isReady: z.boolean(),
})

export const StarDtoSchema = z.object({
  id: StarIdSchema,
  name: z.string(),
  coordinates: StarCoordinatesSchema,
  x: z.number(),
  y: z.number(),
})

export const PlanetDtoSchema = z.object({
  id: PlanetIdSchema,
  ownerPlayerId: PlayerIdSchema.nullable(),
  name: PlanetNameSchema,
  coordinates: PlanetCoordinatesSchema,
  x: z.number(),
  y: z.number(),
  biome: z.enum(PlanetBiome),
  size: z.enum(PlanetSize),
  fertility: z.number(),
  metal: z.number(),
  fuel: z.number(),
  energy: z.number(),
  maxPopulation: z.number(),
  area: z.number(),
})

export const GalaxyDtoSchema = z.object({
  systems: z.array(
    z.object({
      star: StarDtoSchema,
      planets: z.array(PlanetDtoSchema),
    }),
  ),
})

export const FleetDtoSchema = z.object({
  id: FleetIdSchema,
  ownerPlayerId: PlayerIdSchema,
  name: FleetNameSchema,
  strength: z.number(),
  originPlanetId: PlanetIdSchema,
  destinationPlanetId: PlanetIdSchema.optional(),
  distanceToEnd: NonNegativeNumberSchema.optional(),
})

type ActionDto = z.infer<typeof ActionDtoSchema>
const ActionDtoSchema = z.object({
  id: ActionIdSchema,
  actionDefinitionId: ActionDefinitionIdSchema,
  selectedTargets: SelectedTargetsSchema.nullable(),
  canAfford: z.boolean(),
})

export type PlayerViewDto = z.infer<typeof PlayerViewDtoSchema>
export const PlayerViewDtoSchema = z.object({
  gameId: GameIdSchema,
  player: PlayerViewPlayerDtoSchema,
  opponents: z.record(PlayerIdSchema, PlayerViewPlayerDtoSchema),
  galaxy: GalaxyDtoSchema,
  fleets: z.array(FleetDtoSchema).readonly(),
  turn: z.number(),
  turnStatus: z.enum(TurnStatus),
  turnEndsAt: z.date(),
  resources: ResourcesDtoSchema,
  ruleset: RulesetSchema,
  actions: z.array(ActionDtoSchema),
})

export type UpdateReadinessDto = z.infer<typeof UpdateReadinessDtoSchema>
export const UpdateReadinessDtoSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  turn: z.coerce.number(),
  playerId: PlayerIdSchema,
  isReady: z.boolean(),
})
