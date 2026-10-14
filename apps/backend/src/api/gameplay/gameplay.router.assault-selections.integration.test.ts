import { Assert, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { FleetBuildEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { ActionDefinition as ScenarioActionDefinition, PlayerView, Action, Fleet, Planet } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import { BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { processNextRouterTurn } from "../../tests/fleet-gameplay/gameplay.router.ts"

describe("Colonize API boundary", () => {
  integrationTest("should reject strength19 and Influence24 without mutation, then accept strength20 at Influence25", async ({ db }) => {
    // Arrange

    const createClockSetupPhase1Result = await createClockSetup({ db })
    const { apiServices } = createClockSetupPhase1Result
    using apiServer = new ApiServer(apiServices)

    const createPlayerSetupPhase2Result = await createPlayerSetup({ ...createClockSetupPhase1Result, apiServer, db })
    const { player, createdGameId, target, source, colonizeAction } = createPlayerSetupPhase2Result
    const submitColonize = async (strength: number, selectedTurn: number): Promise<void> => {
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: selectedTurn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: colonizeAction.id,
          selectedTargets: { fleet: source.id, planet: target.id },
          selectedInputs: { strength },
        }),
      })
    }

    await createUpdatedVerifyAtTwentyFiveSetup({
      ...createClockSetupPhase1Result,
      ...createPlayerSetupPhase2Result,
      submitColonize,
    })
  })
})

async function assertAtTwentyFive({
  player,
  createdGameId,
  afterInsufficientInfluence,
  gainAction,
  clock,
  turnProcessor,
  turnsRepository,
  view,
  submitColonize,
  source,
  target,
  colonizeAction,
  home,
}: AssertAtTwentyFiveInput): Promise<AssertAtTwentyFiveResult> {
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: afterInsufficientInfluence.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: gainAction.id,
      selectedTargets: {},
      selectedInputs: {},
    }),
  })
  await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
  const atTwentyFive = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  view = atTwentyFive
  expect(atTwentyFive.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
  expect(atTwentyFive.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

  await expect(submitColonize(19, atTwentyFive.turn)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(atTwentyFive)
  expect(atTwentyFive.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 100 })
  expect(atTwentyFive.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

  await submitColonize(20, view.turn)
  const selected = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(selected.actions.find(({ id }) => id === colonizeAction.id)).toMatchObject({
    selectedTargets: { fleet: source.id, planet: target.id },
    selectedInputs: { strength: 20 },
    isInProgress: false,
  })
  expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 0 })
  expect(selected.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(selected.fleets.find(({ id }) => id === source.id)).toMatchObject({
    id: source.id,
    strength: 100,
    originPlanetId: home.id,
  })
  expect(selected.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

  return { view }
}

type AssertAtTwentyFiveInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  afterInsufficientInfluence: PlayerView
  gainAction: Action
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  view: PlayerView
  submitColonize: (strength: number, selectedTurn: number) => Promise<void>
  source: Fleet
  target: Planet
  colonizeAction: Action
  home: Planet
}

type AssertAtTwentyFiveResult = { view: PlayerView }

async function createClockSetup({ db }: CreateClockSetupInput): Promise<CreateClockSetupResult> {
  const clock = new ControlledClock()
  const apiServices = await createApiStub({ db, clock })
  const buildHundred = typedParse(ActionDefinitionSchema, {
    ...BuildFleetStandard,
    id: "FIXTURE_API_BUILD_FLEET_100",
    name: "Fixture API Build Fleet 100",
    costs: [],
    effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 100 })],
  })
  const gainOneInfluence = typedParse(ActionDefinitionSchema, {
    ...GainInfluence,
    id: "FIXTURE_API_GAIN_INFLUENCE_ONE",
    name: "Fixture API Gain One Influence",
    effects: [ResourceGainEffectDefinition.create({ quantity: 1, resourceType: ResourceType.INFLUENCE })],
  })
  const ruleset = Ruleset.create({
    ...TestRuleset,
    id: "test_public_colonize_api_boundary",
    name: "Public Colonize API Boundary Fixture",
    actionDefinitions: indexBy("id", [...Object.values(TestRuleset.actionDefinitions), buildHundred, gainOneInfluence]),
    actionPool: [
      ...TestRuleset.actionPool,
      { id: "FIXTURE_API_BUILD_FLEET_100_1", actionDefinitionId: buildHundred.id },
      { id: "FIXTURE_API_GAIN_INFLUENCE_ONE_1", actionDefinitionId: gainOneInfluence.id },
    ],
    startingResources: {
      ...TestRuleset.startingResources,
      [ResourceType.INFLUENCE]: 24,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 0,
      [ResourceType.COLONY]: 0,
    },
  })
  Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(ruleset))
  return { clock, apiServices, buildHundred, gainOneInfluence, ruleset }
}

async function createPlayerSetup({
  apiServer,
  ruleset,
  db,
  clock,
  buildHundred,
}: CreatePlayerSetupInput): Promise<CreatePlayerSetupResult> {
  const player = await apiServer.createClient({ authenticated: true })
  const { createdGameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: ruleset.id,
      nbSeats: 1,
      mapGenerationSeed: 1234,
      turnIntervalSeconds: 10,
    }),
  })
  await player.client.games.startGame.mutate({ gameId: createdGameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  let view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  const planets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
  const target = planets.find(({ coordinates }) => coordinates === "55:07:50")
  Assert.isDefined(home)
  Assert.isDefined(target)
  expect(target.ownerPlayerId).toBeNull()
  expect(Math.hypot(home.x - target.x, home.y - target.y)).toBeLessThanOrEqual(5)
  expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 24, uncommitted: 24 })
  expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

  const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === buildHundred.id)
  Assert.isDefined(buildAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: view.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: buildAction.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    }),
  })
  await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
  view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  const source = view.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === view.player.id && originPlanetId === home.id && movement === undefined,
  )
  Assert.isDefined(source)
  expect(source.strength).toBe(100)
  expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 24, uncommitted: 24 })

  // Act & Assert
  const colonizeAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizePlanetTest.id)
  Assert.isDefined(colonizeAction)
  return { player, createdGameId, turnProcessor, turnsRepository, view, planets, home, target, source, colonizeAction }
}

async function createUpdatedVerifyAtTwentyFiveSetup({
  player,
  createdGameId,
  submitColonize,
  view,
  source,
  home,
  target,
  gainOneInfluence,
  clock,
  turnProcessor,
  turnsRepository,
  colonizeAction,
}: CreateUpdatedVerifyAtTwentyFiveSetupInput): Promise<CreateUpdatedVerifyAtTwentyFiveSetupResult> {
  const beforeInsufficientInfluence = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  await expect(submitColonize(20, view.turn)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  const afterInsufficientInfluence = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(afterInsufficientInfluence).toStrictEqual(beforeInsufficientInfluence)
  expect(afterInsufficientInfluence.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 24, uncommitted: 24 })
  expect(afterInsufficientInfluence.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(afterInsufficientInfluence.fleets.find(({ id }) => id === source.id)).toMatchObject({
    id: source.id,
    strength: 100,
    originPlanetId: home.id,
  })
  expect(
    afterInsufficientInfluence.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId,
  ).toBeNull()

  const gainAction = afterInsufficientInfluence.actions.find(({ actionDefinitionId }) => actionDefinitionId === gainOneInfluence.id)
  Assert.isDefined(gainAction)

  const updatedVerifyAtTwentyFive = await assertAtTwentyFive({
    player,
    createdGameId,
    afterInsufficientInfluence,
    gainAction,
    clock,
    turnProcessor,
    turnsRepository,
    view,
    submitColonize,
    source,
    target,
    colonizeAction,
    home,
  })
  return { updatedVerifyAtTwentyFive }
}

type CreateClockSetupInput = { db: Database }

type CreateClockSetupResult = {
  clock: ControlledClock
  apiServices: Awaited<ReturnType<typeof createApiStub>>
  buildHundred: ScenarioActionDefinition
  gainOneInfluence: ScenarioActionDefinition
  ruleset: Ruleset
}

type CreatePlayerSetupInput = {
  apiServer: ApiServer
  ruleset: Ruleset
  db: Database
  clock: ControlledClock
  buildHundred: ScenarioActionDefinition
}

type CreatePlayerSetupResult = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  view: PlayerView
  planets: Planet[]
  home: Planet
  target: Planet
  source: Fleet
  colonizeAction: Action
}

type CreateUpdatedVerifyAtTwentyFiveSetupInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  submitColonize: (strength: number, selectedTurn: number) => Promise<void>
  view: PlayerView
  source: Fleet
  home: Planet
  target: Planet
  gainOneInfluence: ScenarioActionDefinition
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  colonizeAction: Action
}

type CreateUpdatedVerifyAtTwentyFiveSetupResult = { updatedVerifyAtTwentyFive: AssertAtTwentyFiveResult }
