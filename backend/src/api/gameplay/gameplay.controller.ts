import { Assert, Rng, Datetime, type Logger, mulberry32Prng, Result, Timer } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import z from "zod"
import { GalaxySettings } from "#api/shared/GalaxySettings.ts"
import { GameId } from "#api/shared/GameId.ts"
import { PlanetCoordinates, toPlanetCoordinates } from "#api/shared/PlanetCoordinates.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { StarCoordinates, toStarCoordinates } from "#api/shared/StarCoordinates.ts"
import type { Clock } from "#lib/Clock.ts"
import { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import { PlanetBiome } from "#lib/db/gameplay/PlanetBiome.ts"
import { PlanetSize } from "#lib/db/gameplay/PlanetSize.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PlayerColor } from "#lib/db/PlayerColor.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { galaxyGenerator } from "#lib/map-generation/galaxy.generator.ts"
import { spiralGenerator } from "#lib/map-generation/points/spiral.generator.ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import { validateActionSubmissions } from "#lib/rules-engine/action-submission/validation/validateActionSubmissions.ts"
import { validateCosts } from "#lib/rules-engine/action-submission/validation/validators/validateCosts.ts"
import { ActionDefinitionIdSchema } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import { ResourceType, ResourceTypeSchema } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { RulesetSchema } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"
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
        amount: STARTING_RESOURCE_AMOUNTS[resourceType],
      }))
      const playerResources = gameForStart.value.playerIds.flatMap((playerId) =>
        startingResources.map((resource) => ({ playerId, ...resource })),
      )

      const startTime = Timer.start()
      const galaxy = createGalaxy(gameForStart.value.mapGenerationSeed)
      this.logger.debug("Generated galaxy", { elapsedTime: Timer.since(startTime) })

      await this.gameplayRepository.startGame(
        {
          game: gameForStart.value,
          status: GameStatus.COLLECTING_ACTIONS,
          startedAt,
          nextTurnAt,
          // Do not reuse the map generation seed, use a "secret" one, otherwise the game can be controlled by the creator
          rngState: { generatorState: UInt32.random(), spareNormal: null },
          playerResources,
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
      return Result.Success(undefined)
    }

    return Result.Success(toPlayerViewDto(playerViewResult.value))
  }

  /**
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  public async getCurrentAction({ gameId, playerId }: GetCurrentActionDto): Promise<Result<ActionSubmissionDto | null, string>> {
    const getCurrentActionResult = await this.createTransaction(async (tx) => {
      const activeGameResult = await this.gameplayRepository.getActionContext({ gameId, playerId }, tx)
      rollbackOnFailure(activeGameResult, "Failed to resolve action context")

      const currentActionResult = await this.gameplayRepository.getCurrentAction(
        {
          gameId,
          playerId,
          turn: activeGameResult.value.turn,
        },
        tx,
      )
      rollbackOnFailure(currentActionResult, "Failed to get current action")

      return currentActionResult.value === null ? null : toActionSubmissionDto(currentActionResult.value.actionSubmission)
    })

    if (Result.isFailure(getCurrentActionResult)) {
      this.logger.error("Failed to get current action", { gameId, playerId, error: getCurrentActionResult.error })
      return Result.Failure(getCurrentActionResult.error.message)
    }

    return Result.Success(getCurrentActionResult.value)
  }

  /**
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  public async setCurrentAction({
    gameId,
    turn,
    playerId,
    actionSubmission: submittedAction,
  }: SetCurrentActionDto): Promise<Result<ActionSubmissionDto | null, string>> {
    const setActionResult = await this.createTransaction(async (tx) => {
      const activeGameResult = await this.gameplayRepository.getActionContext({ gameId, playerId }, tx)
      rollbackOnFailure(activeGameResult, "Failed to resolve action context")

      if (activeGameResult.value.turn !== turn) {
        throw new TransactionRollback(
          `Cannot submit action for turn ${turn}, the game is currently at turn ${activeGameResult.value.turn}.`,
        )
      }

      if (submittedAction === null) {
        const deleteResult = await this.gameplayRepository.clearCurrentAction({ gameId, playerId, turn }, tx)
        rollbackOnFailure(deleteResult, "Failed to clear action")

        return null
      }

      const actionSubmission = {
        ...submittedAction,
        submittedByPlayerId: playerId,
        targets: { ...submittedAction.targets, self: playerId },
      } satisfies ActionSubmission
      const turnState = createTurnState({
        playerId,
        resources: activeGameResult.value.resources,
        actionSubmissions: [actionSubmission],
      })
      const issues = validateActionSubmissions(turnState.actionSubmissions, StandardRuleset, turnState)
      if (issues.length > 0) {
        throw new TransactionRollback(issues.map(({ issue }) => issue).join("\n"))
      }

      const upsertResult = await this.gameplayRepository.setCurrentAction({ gameId, turn, actionSubmission }, tx)
      rollbackOnFailure(upsertResult, "Failed to upsert action")

      return toActionSubmissionDto(upsertResult.value.actionSubmission)
    })

    if (Result.isFailure(setActionResult)) {
      this.logger.error("Failed to set current action", {
        gameId,
        turn,
        playerId,
        actionDefinitionId: submittedAction?.actionDefinitionId,
        error: setActionResult.error,
      })
      return Result.Failure(setActionResult.error.message)
    }

    return Result.Success(setActionResult.value)
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
    resources: playerViewModel.resources,
    ruleset: StandardRuleset,
    availableActions: createAvailableActions(playerViewModel),
  }
}

function createAvailableActions(playerViewModel: PlayerViewModel): AvailableActionDto[] {
  const turnState = createTurnState({
    playerId: playerViewModel.player.id,
    resources: playerViewModel.resources,
    actionSubmissions: [],
  })

  return Object.values(StandardRuleset.actionDefinitions).map((actionDefinition) => {
    const availableAction = {
      id: v4(),
      actionDefinitionId: actionDefinition.id,
      targets: { self: playerViewModel.player.id },
    }
    const actionSubmission = {
      ...availableAction,
      submittedByPlayerId: playerViewModel.player.id,
    } as const satisfies ActionSubmission
    const affordabilityResult = validateCosts([actionSubmission], StandardRuleset, turnState)
    Assert.isSuccess(affordabilityResult)

    return { ...availableAction, canAfford: affordabilityResult.value.length === 0 }
  })
}

function toActionSubmissionDto(actionSubmission: ActionSubmission): ActionSubmissionDto {
  return {
    id: actionSubmission.id,
    actionDefinitionId: actionSubmission.actionDefinitionId,
    targets: actionSubmission.targets,
  }
}

function createTurnState({
  playerId,
  resources,
  actionSubmissions,
}: {
  playerId: PlayerId
  resources: Record<ResourceType, number>
  actionSubmissions: readonly ActionSubmission[]
}): TurnState {
  return {
    actionSubmissions,
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

const TargetIdSchema = z.string()
const ActionSubmissionDto = z.object({
  id: z.string(),
  actionDefinitionId: ActionDefinitionIdSchema,
  targets: z.object({ self: TargetIdSchema }).catchall(TargetIdSchema) satisfies z.ZodType<ActionSubmission["targets"]>,
})
type ActionSubmissionDto = z.infer<typeof ActionSubmissionDto>

const AvailableActionDto = ActionSubmissionDto.extend({ canAfford: z.boolean() })
type AvailableActionDto = z.infer<typeof AvailableActionDto>

export type PlayerViewDto = z.infer<typeof PlayerViewDto>
export const PlayerViewDto = z.object({
  gameId: GameId,
  player: PlayerViewPlayerDto,
  opponents: z.record(PlayerId, PlayerViewPlayerDto),
  galaxy: GalaxyDto,
  turn: z.number(),
  nextTurnAt: z.date(),
  resources: z.record(ResourceTypeSchema, z.number()),
  ruleset: RulesetSchema,
  availableActions: z.array(AvailableActionDto),
})

export type GetCurrentActionDto = z.infer<typeof GetCurrentActionDto>
export const GetCurrentActionDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
})

export type SetCurrentActionDto = z.infer<typeof SetCurrentActionDto>
export const SetCurrentActionDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
  turn: z.coerce.number(),
  actionSubmission: ActionSubmissionDto.nullable(),
})

export const CurrentActionDto = z.object({
  action: ActionSubmissionDto.nullable(),
})
