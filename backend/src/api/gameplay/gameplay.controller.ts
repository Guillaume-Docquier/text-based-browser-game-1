import { Assert, Rng, Datetime, type Logger, mulberry32Prng, Result, Timer, branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { type ResourceAmountsDto, ResourcesDtoSchema } from "#api/gameplay/ResourcesDto.ts"
import { SubmittedActionTargetsDtoSchema } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import { GalaxySettings } from "#api/shared/GalaxySettings.ts"
import { PlanetCoordinatesSchema, toPlanetCoordinates } from "#api/shared/PlanetCoordinates.ts"
import { StarCoordinatesSchema, toStarCoordinates } from "#api/shared/StarCoordinates.ts"
import type { Clock } from "#lib/Clock.ts"
import { AccountIdSchema, type AccountId } from "#lib/db/accounts/AccountId.ts"
import { ActionIdSchema } from "#lib/db/actions/ActionId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { GameIdSchema, type GameId } from "#lib/db/games/GameId.ts"
import { GameStatus } from "#lib/db/games/GameStatus.ts"
import { PlanetBiome } from "#lib/db/planets/PlanetBiome.ts"
import { PlanetIdSchema, type PlanetId } from "#lib/db/planets/PlanetId.ts"
import { PlanetSize } from "#lib/db/planets/PlanetSize.ts"
import { PlayerColor } from "#lib/db/players/PlayerColor.ts"
import { PlayerIdSchema, type PlayerId } from "#lib/db/players/PlayerId.ts"
import { StarIdSchema } from "#lib/db/stars/StarId.ts"
import { TurnStatus } from "#lib/db/turns/TurnStatus.ts"
import { couldNot, TransactionRollbackError } from "#lib/errors.ts"
import { indexById } from "#lib/indexById.ts"
import { galaxyGenerator } from "#lib/map-generation/galaxy.generator.ts"
import { spiralGenerator } from "#lib/map-generation/points/spiral.generator.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { computeAvailableActions } from "#lib/rules-engine/action-submission/computeAvailableActions.ts"
import { getUncommittedResources } from "#lib/rules-engine/action-submission/getUncommittedResources.ts"
import { validateSubmittedActions } from "#lib/rules-engine/action-submission/validation/validateSubmittedActions.ts"
import { validateCosts } from "#lib/rules-engine/action-submission/validation/validators/validateCosts.ts"
import { ActionDefinitionIdSchema } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import { SelectedTargetsSchema } from "#lib/rules-engine/ruleset-model/actions/SelectedTargets.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { RulesetSchema } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { Fleet, Planet, TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import { UInt32 } from "#lib/UInt32.ts"
import { assignHomePlanets } from "./assignHomePlanets.ts"
import type { GalaxyModel } from "./GalaxyModel.ts"
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
      const galaxy = assignHomePlanets({ galaxy: createGalaxy(rng), playerIds: gameForStart.playerIds, rng })
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

  /**
   * Long term we'll probably want a batch submission
   */
  public async updateActionSubmission({
    gameId,
    playerId,
    turn,
    submittedActionTargets,
  }: UpdateActionSubmissionDto): Promise<Result<void, string>> {
    const setActionResult = await this.createTransaction(async (tx) => {
      const planetIds = getValidPlanetIds(Object.values(submittedActionTargets.selectedTargets ?? {}))
      const context = await this.gameplayRepository.getActionSubmissionsForUpdate({ gameId, playerId, turn, planetIds }, tx)
      const actionsById = new Map(Array.from(context.actions, (action) => [action.id, action]))
      const action = actionsById.get(submittedActionTargets.actionId)
      if (action === undefined) {
        throw new TransactionRollbackError("Invalid action id")
      }

      if (submittedActionTargets.selectedTargets === null) {
        await this.gameplayRepository.updateActionSubmissions(
          { context, actions: [{ id: submittedActionTargets.actionId, selectedTargets: null }] },
          tx,
        )
        return
      }

      const submittedAction = {
        id: submittedActionTargets.actionId,
        actionDefinitionId: action.actionDefinitionId,
        playerId,
        selectedTargets: submittedActionTargets.selectedTargets,
      } satisfies SubmittedAction

      const turnState = createTurnState({
        gameId: context.gameId,
        turn,
        playerId,
        resources: context.resources,
        submittedActions: [submittedAction],
        planets: [...context.planets],
        fleets: [], // definitely matters, need the data. Should pull only the required data, not all the fleets.
      })
      const issues = validateSubmittedActions(turnState.submittedActions, context.ruleset, turnState)
      if (issues.length > 0) {
        throw new TransactionRollbackError(issues.map(({ issue }) => issue).join("\n"))
      }

      await this.gameplayRepository.updateActionSubmissions({ context, actions: [submittedAction] }, tx)
    })

    if (Result.isFailure(setActionResult)) {
      this.logger.error("Failed to set current action", {
        gameId,
        turn,
        playerId,
        actionId: submittedActionTargets.actionId,
        error: setActionResult.error,
      })
      return Result.Failure(setActionResult.error.message)
    }

    return Result.Success(undefined)
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

function createGalaxy(rng: Rng): GalaxyModel {
  const generatedGalaxy = galaxyGenerator({
    size: GalaxySettings.GALAXY_SIZE_LIGHT_YEARS,
    pointsGenerator: () =>
      spiralGenerator({
        origin: GalaxySettings.GALAXY_ORIGIN,
        radius: GalaxySettings.GALAXY_RADIUS_LIGHT_YEARS,
        nbPoints: GalaxySettings.GALAXY_SYSTEMS_COUNT,
        rng,
      }),
    rng,
  })

  let nextPlanetId = 1
  return {
    systems: generatedGalaxy.systems.map((system, starIndex) => {
      const starCoordinates = toStarCoordinates(system.star)

      return {
        star: {
          id: branded(starIndex + 1),
          ...system.star,
          coordinates: starCoordinates,
        },
        planets: system.planets.map((planet) => ({
          id: branded(nextPlanetId++),
          ownerPlayerId: null,
          ...planet,
          coordinates: toPlanetCoordinates({ starCoordinates, star: system.star, planet }),
        })),
      }
    }),
  }
}

function getValidPlanetIds(targetIds: readonly string[]): PlanetId[] {
  return [
    ...new Set(
      targetIds.flatMap((targetId) => {
        const value = Number(targetId)
        return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647 ? [branded<PlanetId>(value)] : []
      }),
    ),
  ]
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

function createTurnState({
  gameId,
  turn,
  playerId,
  resources,
  submittedActions,
  planets,
  fleets,
}: {
  gameId: GameId
  turn: number
  playerId: PlayerId
  resources: Resources
  submittedActions: readonly SubmittedAction[]
  planets: Planet[]
  fleets: Fleet[]
}): TurnState {
  return {
    gameId,
    turn,
    submittedActions,
    players: {
      [playerId]: {
        id: playerId,
        resources,
      },
    },
    planets: indexById(planets),
    fleets: indexById(fleets),
    winnerPlayerId: undefined,
  }
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
  name: z.string(),
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
  turn: z.number(),
  turnStatus: z.enum(TurnStatus),
  turnEndsAt: z.date(),
  resources: ResourcesDtoSchema,
  ruleset: RulesetSchema,
  actions: z.array(ActionDtoSchema),
})

export type UpdateActionSubmissionDto = z.infer<typeof UpdateActionSubmissionDtoSchema>
export const UpdateActionSubmissionDtoSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  playerId: PlayerIdSchema,
  turn: z.coerce.number(),
  submittedActionTargets: SubmittedActionTargetsDtoSchema,
})

export type UpdateReadinessDto = z.infer<typeof UpdateReadinessDtoSchema>
export const UpdateReadinessDtoSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  turn: z.coerce.number(),
  playerId: PlayerIdSchema,
  isReady: z.boolean(),
})
