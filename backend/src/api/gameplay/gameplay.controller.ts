import { Assert, Datetime, type Logger, mulberry32Prng, Result, Rng, Timer } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { createGalaxy } from "#api/gameplay/galaxy-creation/createGalaxy.ts"
import { GalaxyCreationSettings } from "#api/gameplay/galaxy-creation/GalaxyCreationSettings.ts"
import { PlanetCoordinatesSchema } from "#api/gameplay/galaxy-creation/PlanetCoordinates.ts"
import { StarCoordinatesSchema } from "#api/gameplay/galaxy-creation/StarCoordinates.ts"
import { type ResourceAmountsDto, ResourcesDtoSchema } from "#api/gameplay/ResourcesDto.ts"
import { SubmittedActionTargetsDtoSchema } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { Clock } from "#lib/Clock.ts"
import { type AccountId, AccountIdSchema } from "#lib/db/accounts/AccountId.ts"
import { ActionIdSchema } from "#lib/db/actions/ActionId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { type GameId, GameIdSchema } from "#lib/db/games/GameId.ts"
import { GameStatus } from "#lib/db/games/GameStatus.ts"
import { PlanetBiome } from "#lib/db/planets/PlanetBiome.ts"
import { PlanetIdSchema } from "#lib/db/planets/PlanetId.ts"
import { PlanetSize } from "#lib/db/planets/PlanetSize.ts"
import { PlayerColor } from "#lib/db/players/PlayerColor.ts"
import { type PlayerId, PlayerIdSchema } from "#lib/db/players/PlayerId.ts"
import { StarIdSchema } from "#lib/db/stars/StarId.ts"
import { TurnStatus } from "#lib/db/turns/TurnStatus.ts"
import { couldNot } from "#lib/errors.ts"
import { indexById } from "#lib/indexById.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { computeAvailableActions } from "#lib/rules-engine/action-submission/computeAvailableActions.ts"
import { getUncommittedResources } from "#lib/rules-engine/action-submission/getUncommittedResources.ts"
import { validateSubmittedActions } from "#lib/rules-engine/action-submission/validation/validateSubmittedActions.ts"
import { validateCosts } from "#lib/rules-engine/action-submission/validation/validators/validateCosts.ts"
import { ActionDefinitionIdSchema } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import { SelectedTargetsSchema } from "#lib/rules-engine/ruleset-model/actions/SelectedTargets.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { RulesetSchema } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { safeResolveTargetId } from "#lib/rules-engine/turn-resolution/effects/resolveTargetId.ts"
import type { Fleet, Planet, Player, TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import { UInt32 } from "#lib/UInt32.ts"
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
      const context = await this.gameplayRepository.getActionSubmissionsForUpdate({ gameId, playerId, turn }, tx)

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

      const actionDefinition = context.ruleset.actionDefinitions[submittedAction.actionDefinitionId]
      if (actionDefinition === undefined) {
        throw new TransactionRollbackError("No action definition found", {
          cause: { actionDefinitionId: submittedAction.actionDefinitionId },
        })
      }

      const planetIds = [
        ...new Set(
          Object.entries(actionDefinition.targets)
            .map(([tag, targetDefinition]) => {
              if (targetDefinition.type !== TargetType.PLANET) {
                return null
              }

              return safeResolveTargetId(submittedAction.selectedTargets, {
                tag,
                type: TargetType.PLANET,
                constraints: targetDefinition.constraints,
              })
            })
            .filter((planetId) => planetId !== null),
        ),
      ]
      const planets = await this.gameplayRepository.getPlanetsByIds({ gameId: context.gameId, planetIds }, tx)

      const fleetIds = [
        ...new Set(
          Object.entries(actionDefinition.targets)
            .map(([tag, targetDefinition]) => {
              if (targetDefinition.type !== TargetType.FLEET) {
                return null
              }

              return safeResolveTargetId(submittedAction.selectedTargets, {
                tag,
                type: TargetType.FLEET,
                constraints: targetDefinition.constraints,
              })
            })
            .filter((fleetId) => fleetId !== null),
        ),
      ]
      const fleets = await this.gameplayRepository.getFleetsByIds({ gameId: context.gameId, fleetIds }, tx)

      const playerIds = [
        ...new Set(
          Object.entries(actionDefinition.targets)
            .map(([tag, targetDefinition]) => {
              if (targetDefinition.type !== TargetType.PLAYER) {
                return null
              }

              return safeResolveTargetId(submittedAction.selectedTargets, {
                tag,
                type: TargetType.PLAYER,
                constraints: targetDefinition.constraints,
              })
            })
            .filter((targetPlayerId) => targetPlayerId !== null),
        ),
      ]
      const targetPlayers = await this.gameplayRepository.getPlayersByIds({ gameId: context.gameId, playerIds }, tx)

      const turnState = createTurnState({
        gameId: context.gameId,
        turn,
        playerId,
        resources: context.resources,
        submittedActions: [submittedAction],
        targetPlayers,
        planets,
        fleets,
      })
      const validationResult = validateSubmittedActions(turnState.submittedActions, context.ruleset, turnState)
      if (Result.isFailure(validationResult)) {
        this.logger.error("Could not validate action submission", {
          gameId,
          turn,
          playerId,
          actionId: submittedActionTargets.actionId,
          error: validationResult.error,
        })
        throw new TransactionRollbackError(couldNot("validate action submission"), { cause: validationResult.error })
      }

      if (validationResult.value.length > 0) {
        throw new TransactionRollbackError(validationResult.value.map(({ issue }) => issue).join("\n"))
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
  targetPlayers = [],
  planets,
  fleets,
}: {
  gameId: GameId
  turn: number
  playerId: PlayerId
  resources: Resources
  submittedActions: readonly SubmittedAction[]
  targetPlayers?: Player[]
  planets: Planet[]
  fleets: Fleet[]
}): TurnState {
  return {
    gameId,
    turn,
    submittedActions,
    players: indexById([...targetPlayers, { id: playerId, resources }]),
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
