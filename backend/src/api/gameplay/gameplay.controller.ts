import { Assert, Rng, Datetime, type Logger, mulberry32Prng, Result, Timer } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { type ResourceAmountsDto, ResourcesDtoSchema } from "#api/gameplay/ResourcesDto.ts"
import { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import { GalaxySettings } from "#api/shared/GalaxySettings.ts"
import { GameId } from "#api/shared/GameId.ts"
import { PlanetCoordinates, toPlanetCoordinates } from "#api/shared/PlanetCoordinates.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { StarCoordinates, toStarCoordinates } from "#api/shared/StarCoordinates.ts"
import type { Clock } from "#lib/Clock.ts"
import { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { PlanetBiome } from "#lib/db/gameplay/PlanetBiome.ts"
import { PlanetSize } from "#lib/db/gameplay/PlanetSize.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PlayerColor } from "#lib/db/PlayerColor.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { galaxyGenerator } from "#lib/map-generation/galaxy.generator.ts"
import { spiralGenerator } from "#lib/map-generation/points/spiral.generator.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { computeAvailableActions } from "#lib/rules-engine/action-submission/computeAvailableActions.ts"
import { getUncommittedResources } from "#lib/rules-engine/action-submission/getUncommittedResources.ts"
import { validateSubmittedActions } from "#lib/rules-engine/action-submission/validation/validateSubmittedActions.ts"
import { validateCosts } from "#lib/rules-engine/action-submission/validation/validators/validateCosts.ts"
import { ActionDefinitionIdSchema } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { RulesetSchema } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import { UInt32 } from "#lib/UInt32.ts"
import { type GalaxyModel, type GameplayRepository, type PlayerViewModel } from "./gameplay.repository.ts"

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
      rollbackOnFailure(gameForStart, "Game cannot start")

      if (gameForStart.value.createdByAccountId !== requesterAccountId) {
        throw new TransactionRollback("Only the game creator can start it.")
      }

      if (gameForStart.value.status !== GameStatus.WAITING_FOR_PLAYERS && gameForStart.value.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollback("The game cannot start in its current status.", {
          cause: { status: gameForStart.value.status, expected: [GameStatus.WAITING_FOR_PLAYERS, GameStatus.READY_TO_START] },
        })
      }

      const startedAt = this.clock.now()
      const nextTurnAt = Datetime.increment({ date: startedAt, time: gameForStart.value.turnInterval })

      const startingResources = Object.values(ResourceType).map((resourceType) => ({
        resourceType,
        amount: gameForStart.value.ruleset.startingResources[resourceType],
      }))
      const playerResources = gameForStart.value.playerIds.flatMap((playerId) =>
        startingResources.map((resource) => ({ playerId, ...resource })),
      )

      const startTime = Timer.start()
      const galaxy = createGalaxy(gameForStart.value.mapGenerationSeed)
      this.logger.debug("Generated galaxy", { elapsedTime: Timer.since(startTime) })

      await this.gameplayRepository.startGame(
        {
          context: gameForStart.value,
          status: GameStatus.COLLECTING_ACTIONS,
          startedAt,
          nextTurnAt,
          // Do not reuse the map generation seed, use a "secret" one, otherwise the game can be controlled by the creator
          rngState: { generatorState: UInt32.random(), spareNormal: null },
          playerResources,
          availableActions: computeAvailableActions({
            playerIds: gameForStart.value.playerIds,
            ruleset: gameForStart.value.ruleset,
          }),
          galaxy,
        },
        tx,
      )

      return { nextTurnAt }
    })

    if (Result.isFailure(startGameResult)) {
      this.logger.error("Could not start game", { gameId, requesterAccountId, error: startGameResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return startGameResult
  }

  public async hasPlayerJoinedGame({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<boolean, string>> {
    return await this.gameplayRepository.hasPlayerJoinedGame({ gameId, playerId })
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
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  public async setCurrentAction({ gameId, playerId, turn, submittedActionTargets }: SetCurrentActionDto): Promise<Result<void, string>> {
    const setActionResult = await this.createTransaction(async (tx) => {
      const context = await this.gameplayRepository.getActionSubmissionsForUpdate({ gameId, playerId, turn }, tx)
      const actionsById = new Map(Array.from(context.actions, (action) => [action.id, action]))
      const action = actionsById.get(submittedActionTargets.actionId)
      if (action === undefined) {
        throw new TransactionRollback("Invalid action id")
      }

      if (submittedActionTargets.targets === null) {
        await this.gameplayRepository.updateActionSubmissions(
          { context, actions: [{ id: submittedActionTargets.actionId, targets: null }] },
          tx,
        )
        return
      }

      const submittedAction = {
        id: submittedActionTargets.actionId,
        actionDefinitionId: action.actionDefinitionId,
        playerId,
        targets: { ...submittedActionTargets.targets, self: playerId },
      } satisfies SubmittedAction

      const turnState = createTurnState({ playerId, resources: context.resources, submittedActions: [submittedAction] })
      const issues = validateSubmittedActions(turnState.submittedActions, context.ruleset, turnState)
      if (issues.length > 0) {
        throw new TransactionRollback(issues.map(({ issue }) => issue).join("\n"))
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
}

function createGalaxy(seed: number): GalaxyModel {
  const rng = Rng.create(mulberry32Prng(seed))
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
          id: starIndex + 1,
          ...system.star,
          coordinates: starCoordinates,
        },
        planets: system.planets.map((planet) => ({
          id: nextPlanetId++,
          ...planet,
          coordinates: toPlanetCoordinates({ starCoordinates, star: system.star, planet }),
        })),
      }
    }),
  }
}

function toPlayerViewDto(playerViewModel: PlayerViewModel): PlayerViewDto {
  const uncommittedResources = getUncommittedResources({
    resources: playerViewModel.resources,
    actions: playerViewModel.actions.filter((action) => action.targets !== null),
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
    nextTurnAt: playerViewModel.nextTurnAt,
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
    playerId: playerViewModel.player.id,
    resources: uncommittedResources,
    submittedActions: [],
  })

  return playerViewModel.actions.map((action) => {
    if (action.targets !== null) {
      // If the action is submitted already (targets are defined), then the action is affordable because it's been committed already
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
          targets: {
            self: playerViewModel.player.id,
          },
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
  playerId,
  resources,
  submittedActions,
}: {
  playerId: PlayerId
  resources: Resources
  submittedActions: readonly SubmittedAction[]
}): TurnState {
  return {
    submittedActions,
    players: {
      [playerId]: {
        id: playerId,
        resources,
      },
    },
    winnerPlayerId: undefined,
  }
}

export type StartGameDto = z.infer<typeof StartGameDto>
export const StartGameDto = z.object({
  gameId: z.coerce.number(),
  requesterAccountId: AccountId,
})

export type StartedGameDto = z.infer<typeof StartedGameDto>
export const StartedGameDto = z.object({
  nextTurnAt: z.date(),
})

export type GetPlayerViewDto = z.infer<typeof GetPlayerViewDto>
export const GetPlayerViewDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
})

export type PlayerViewPlayerDto = z.infer<typeof PlayerViewPlayerDto>
export const PlayerViewPlayerDto = z.object({ id: PlayerId, color: z.enum(PlayerColor) })

export const StarDto = z.object({
  id: z.number(),
  name: z.string(),
  coordinates: StarCoordinates,
  x: z.number(),
  y: z.number(),
})

export const PlanetDto = z.object({
  id: z.number(),
  name: z.string(),
  coordinates: PlanetCoordinates,
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

export const GalaxyDto = z.object({
  systems: z.array(
    z.object({
      star: StarDto,
      planets: z.array(PlanetDto),
    }),
  ),
})

type ActionDto = z.infer<typeof ActionDto>
const ActionDto = z.object({
  id: z.string(),
  actionDefinitionId: ActionDefinitionIdSchema,
  targets: z.record(z.string(), z.string()).nullable(),
  canAfford: z.boolean(),
})

export type PlayerViewDto = z.infer<typeof PlayerViewDto>
export const PlayerViewDto = z.object({
  gameId: GameId,
  player: PlayerViewPlayerDto,
  opponents: z.record(PlayerId, PlayerViewPlayerDto),
  galaxy: GalaxyDto,
  turn: z.number(),
  nextTurnAt: z.date(),
  resources: ResourcesDtoSchema,
  ruleset: RulesetSchema,
  actions: z.array(ActionDto),
})

export type SetCurrentActionDto = z.infer<typeof SetCurrentActionDto>
export const SetCurrentActionDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
  turn: z.coerce.number(),
  submittedActionTargets: SubmittedActionTargetsDto,
})
