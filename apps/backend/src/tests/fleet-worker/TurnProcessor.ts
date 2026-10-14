import { Assert, branded, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetBuildEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { AttackMoveTest, FlexibleAssaultTest, StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetImproved, BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { expect } from "vitest"
import type { Planet, Fleet, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ApiServer } from "#tests/ApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { processPublicTurn, getActionToSubmintegrationTest } from "./TurnProcessor.scenarios.ts"

export const SpeedTwoAssaultWorkerTest = typedParse(ActionDefinitionSchema, {
  ...FlexibleAssaultTest,
  id: "TEST_SPEED_TWO_ASSAULT",
  name: "Worker Speed Two Assault",
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 1, resourceType: ResourceType.FUEL }),
  ],
})

export const ChargedStationaryAssaultWorkerTest = typedParse(ActionDefinitionSchema, {
  ...StationaryAssaultTest,
  id: "TEST_CHARGED_STATIONARY_ASSAULT",
  name: "Charged Stationary Assault",
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 1, resourceType: ResourceType.FUEL }),
  ],
})

export const TickFiveAttackMoveWorkerTest = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "TEST_TICK_FIVE_ATTACK_MOVE",
  name: "Tick Five Assault",
  effects: AttackMoveTest.effects.map((effect) =>
    effect.type === FleetMoveEffectDefinition.type ? { ...effect, parameters: { ...effect.parameters, speed: 20 } } : effect,
  ),
})

export const TickTenAttackMoveWorkerTest = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "TEST_TICK_TEN_ATTACK_MOVE",
  name: "Tick Ten Assault",
  effects: AttackMoveTest.effects.map((effect) =>
    effect.type === FleetMoveEffectDefinition.type ? { ...effect, parameters: { ...effect.parameters, speed: 9.5 } } : effect,
  ),
})

export const TickFifteenAttackMoveWorkerTest = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "TEST_TICK_FIFTEEN_ATTACK_MOVE",
  name: "Tick Fifteen Assault",
  effects: AttackMoveTest.effects.map((effect) =>
    effect.type === FleetMoveEffectDefinition.type ? { ...effect, parameters: { ...effect.parameters, speed: 6 } } : effect,
  ),
})

export const AssaultWorkerRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_assault_worker_round_trip",
  name: "Test Assault Worker Round Trip",
  actionDefinitions: {
    ...TestRuleset.actionDefinitions,
    [FlexibleAssaultTest.id]: FlexibleAssaultTest,
    [SpeedTwoAssaultWorkerTest.id]: SpeedTwoAssaultWorkerTest,
    [ChargedStationaryAssaultWorkerTest.id]: ChargedStationaryAssaultWorkerTest,
    [TickFiveAttackMoveWorkerTest.id]: TickFiveAttackMoveWorkerTest,
    [TickTenAttackMoveWorkerTest.id]: TickTenAttackMoveWorkerTest,
    [TickFifteenAttackMoveWorkerTest.id]: TickFifteenAttackMoveWorkerTest,
  },
  actionPool: [
    ...TestRuleset.actionPool.filter(({ id }) => id !== "TEST_SPEED_TWO_ASSAULT_1"),
    { id: "TEST_SPEED_TWO_ASSAULT_1", actionDefinitionId: SpeedTwoAssaultWorkerTest.id },
    { id: "TEST_CHARGED_STATIONARY_ASSAULT_1", actionDefinitionId: ChargedStationaryAssaultWorkerTest.id },
    { id: "TEST_TICK_FIVE_ATTACK_MOVE_1", actionDefinitionId: TickFiveAttackMoveWorkerTest.id },
    { id: "TEST_TICK_TEN_ATTACK_MOVE_1", actionDefinitionId: TickTenAttackMoveWorkerTest.id },
    { id: "TEST_TICK_FIFTEEN_ATTACK_MOVE_1", actionDefinitionId: TickFifteenAttackMoveWorkerTest.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

export const HomeArrivalMergeRuleset = Ruleset.create({
  ...AssaultWorkerRuleset,
  id: "test_home_arrival_merge_worker",
  name: "Test Home Arrival Merge Worker",
  actionPool: [...AssaultWorkerRuleset.actionPool, { id: "TEST_ATTACK_MOVE_2", actionDefinitionId: AttackMoveTest.id }],
})

export const WorkerI207Ruleset = Ruleset.create({
  ...AssaultWorkerRuleset,
  id: "test_i207_worker_controls",
  name: "Test I2-07 Worker Controls",
  actionPool: [...AssaultWorkerRuleset.actionPool, { id: `${MoveFleetExceptional.id}_2`, actionDefinitionId: MoveFleetExceptional.id }],
})

export const MultiInstanceTestRuleset = Ruleset.create({
  ...TestRuleset,
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
    { id: "MOVE_FLEET_STANDARD_3", actionDefinitionId: MoveFleetStandard.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

export const SlowMoveFleetStandard = typedParse(ActionDefinitionSchema, {
  ...MoveFleetStandard,
  effects: MoveFleetStandard.effects.map((effect) =>
    effect.type === FleetMoveEffectDefinition.type ? { ...effect, parameters: { ...effect.parameters, speed: 0.5 } } : effect,
  ),
})

export const SlowContinuationRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_slow_continuation_payment",
  name: "Slow Continuation Payment Test",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [SlowMoveFleetStandard.id]: SlowMoveFleetStandard },
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

export const WorkerEnemyArrivalBuildStandard = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 20 })],
})

export const WorkerEnemyArrivalBuildImproved = typedParse(ActionDefinitionSchema, {
  ...BuildFleetImproved,
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 7 })],
})

export const WorkerEnemyArrivalMoveStandard = typedParse(ActionDefinitionSchema, {
  ...MoveFleetStandard,
  targets: {
    ...MoveFleetStandard.targets,
    [branded<TargetTag>("planet")]: {
      ...MoveFleetStandard.targets[branded<TargetTag>("planet")],
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance: 100_000 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" }),
      ],
    },
  },
  effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 100_000 })],
})

export const EnemyArrivalRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_worker_enemy_arrival",
  name: "Worker Enemy Arrival Test",
  actionDefinitions: {
    ...TestRuleset.actionDefinitions,
    [WorkerEnemyArrivalBuildStandard.id]: WorkerEnemyArrivalBuildStandard,
    [WorkerEnemyArrivalBuildImproved.id]: WorkerEnemyArrivalBuildImproved,
    [WorkerEnemyArrivalMoveStandard.id]: WorkerEnemyArrivalMoveStandard,
  },
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

export type PublicHomeArrivalFixture = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  playerIds: readonly [PlayerId, PlayerId]
  gameId: number
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  aliceHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
  bobHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
  aliceAtSource: PlayerView["fleets"][number] | undefined
  aliceAtTarget: PlayerView["fleets"][number] | undefined
  bobAtSource: PlayerView["fleets"][number] | undefined
  bobAtTarget: PlayerView["fleets"][number] | undefined
  distance: number
}

export async function createPublicHomeArrivalFixture({
  db,
  clock,
  apiServer,
  ruleset,
  aliceDepartureStrength,
  bobDepartureStrength,
  bobStartingStrength = bobDepartureStrength,
}: CreatePublicHomeArrivalFixtureInput): Promise<PublicHomeArrivalFixture> {
  const pair = await createHomePair({ db, clock, apiServer, ruleset })
  const built = await buildHomeArrivalFleets(pair, { bobDepartureStrength, bobStartingStrength })
  const stagedView = await sendHomeArrivals(pair, built, { aliceDepartureStrength, bobDepartureStrength })
  const arrivals = inspectHomeArrival(pair, stagedView, { aliceDepartureStrength, bobDepartureStrength, bobStartingStrength })
  return {
    clients: pair.clients,
    playerIds: pair.playerIds,
    gameId: pair.gameId,
    turnProcessor: pair.turnProcessor,
    turnsRepository: pair.turnsRepository,
    aliceHome: pair.aliceHome,
    bobHome: pair.bobHome,
    ...arrivals,
    distance: 4.418312565270031,
  }
}
type HomePair = Pick<
  PublicHomeArrivalFixture,
  "clients" | "playerIds" | "gameId" | "turnProcessor" | "turnsRepository" | "aliceHome" | "bobHome"
> & { alice: AuthenticatedApiClient; bob: AuthenticatedApiClient; gameId: GameId }
type HomeArrivalFleets = { aliceBuilt: PlayerView["fleets"][number]; bobBuilt: PlayerView["fleets"][number] }
type HomeArrivalStrengths = { aliceDepartureStrength: number; bobDepartureStrength: number; bobStartingStrength: number }
type HomeArrivalPositions = Pick<PublicHomeArrivalFixture, "aliceAtSource" | "aliceAtTarget" | "bobAtSource" | "bobAtTarget">
async function createHomePair(
  input: Pick<CreatePublicHomeArrivalFixtureInput, "db" | "clock" | "apiServer" | "ruleset">,
): Promise<HomePair> {
  // Arrange: establish the fixed seed-147 home pair through the public game lifecycle.
  const alice = await input.apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
  const bob = await input.apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
  const clients = [alice, bob] as const
  const playerIds = [branded<PlayerId>(alice.account.id), branded<PlayerId>(bob.account.id)] as const
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: input.ruleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(Time.create(10, UnitOfTime.SECONDS), UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: input.db, clock: input.clock })
  const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerIds[0])
  const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerIds[1])
  Assert.isDefined(aliceHome)
  Assert.isDefined(bobHome)
  expect({
    aliceHome: { id: aliceHome.id, name: aliceHome.name, coordinates: aliceHome.coordinates },
    bobHome: { id: bobHome.id, name: bobHome.name, coordinates: bobHome.coordinates },
    distance: Math.hypot(aliceHome.x - bobHome.x, aliceHome.y - bobHome.y),
  }).toStrictEqual({
    aliceHome: { id: "57c1b320-c267-5c9b-a5a5-1b5a02823714", name: "planet 552840", coordinates: "45:83:40" },
    bobHome: { id: "ec56a9af-3995-521c-822d-84685a96fdc6", name: "planet 819299", coordinates: "44:98:05" },
    distance: 4.418312565270031,
  })

  return { alice, bob, clients, playerIds, gameId, turnProcessor, turnsRepository, aliceHome, bobHome }
}
async function buildHomeArrivalFleets(
  pair: HomePair,
  { bobDepartureStrength, bobStartingStrength }: Pick<HomeArrivalStrengths, "bobDepartureStrength" | "bobStartingStrength">,
): Promise<HomeArrivalFleets> {
  const { alice, bob, clients, gameId, turnProcessor, playerIds, aliceHome, bobHome } = pair // Arrange: use public Build submissions and real worker turns to create Alice40 and Bob's requested defender force.

  await verifyBobBuildRounds({ bobDepartureStrength, bobStartingStrength, clients, gameId, alice, aliceHome, bob, bobHome, turnProcessor })
  const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const aliceBuilt = stationaryHomeFleet(builtView, playerIds[0], aliceHome.id)
  const bobBuilt = stationaryHomeFleet(builtView, playerIds[1], bobHome.id)
  Assert.isDefined(aliceBuilt)
  Assert.isDefined(bobBuilt)
  expect(aliceBuilt.strength).toBe(40)
  expect(bobBuilt.strength).toBe(Math.ceil(Math.max(bobDepartureStrength, bobStartingStrength) / 10) * 10)

  return { aliceBuilt, bobBuilt }
}
async function sendHomeArrivals(
  pair: HomePair,
  built: HomeArrivalFleets,
  { aliceDepartureStrength, bobDepartureStrength }: Pick<HomeArrivalStrengths, "aliceDepartureStrength" | "bobDepartureStrength">,
): Promise<PlayerView> {
  const { clients, gameId } = pair
  const departureViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
  const aliceDepartureView = departureViews[0],
    bobDepartureView = departureViews[1]
  Assert.isDefined(aliceDepartureView)
  Assert.isDefined(bobDepartureView)
  await verifyActionSelections({ ...pair, ...built, aliceDepartureView, bobDepartureView, aliceDepartureStrength, bobDepartureStrength })
  return await pair.alice.client.gameplay.getPlayerView.query({ gameId })
}
function inspectHomeArrival(pair: HomePair, stagedView: PlayerView, strengths: HomeArrivalStrengths): HomeArrivalPositions {
  const { playerIds, aliceHome, bobHome } = pair
  const aliceAtSource = stationaryHomeFleet(stagedView, playerIds[0], bobHome.id)
  const aliceAtTarget = stationaryHomeFleet(stagedView, playerIds[0], aliceHome.id)
  const bobAtSource = stationaryHomeFleet(stagedView, playerIds[1], bobHome.id)
  const bobAtTarget = stationaryHomeFleet(stagedView, playerIds[1], aliceHome.id)
  assertAliceHomeArrival(aliceAtSource, aliceAtTarget, strengths.aliceDepartureStrength)
  Assert.isDefined(bobAtTarget)
  expect(bobAtTarget.strength).toBe(strengths.bobDepartureStrength)
  if (strengths.bobStartingStrength > strengths.bobDepartureStrength) {
    Assert.isDefined(bobAtSource)
    expect(bobAtSource.strength).toBe(Math.ceil(strengths.bobStartingStrength / 10) * 10 - strengths.bobDepartureStrength)
  }
  return { aliceAtSource, aliceAtTarget, bobAtSource, bobAtTarget }
}
function assertAliceHomeArrival(
  source: PlayerView["fleets"][number] | undefined,
  target: PlayerView["fleets"][number] | undefined,
  strength: number,
): void {
  if (strength === 0) {
    expect(source).toBeUndefined()
    expect(target).toMatchObject({ strength: 40 })
    return
  }
  Assert.isDefined(source)
  expect(source.strength).toBe(strength)
  if (strength === 40) {
    expect(target).toBeUndefined()
    return
  }
  expect(target?.strength).toBe(40 - strength)
}

export type PublicAssaultStagingFixture = {
  clients: AuthenticatedApiClient[]
  playerIds: PlayerId[]
  gameId: number
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
  stagingPlanet: PlayerView["galaxy"]["systems"][number]["planets"][number]
  homes: Array<PlayerView["galaxy"]["systems"][number]["planets"][number]>
  stationed: Array<PlayerView["fleets"][number]>
}

export async function createPublicAssaultStagingFixture(
  input: CreatePublicAssaultStagingFixtureInput,
): Promise<PublicAssaultStagingFixture> {
  // Arrange: create/join/start a fresh fixed-seed game exclusively through the public API.

  const initialClientsSetup1 = await createInitialClientsSetup({
    ...input,
    availableClients: input.clients,
    ruleset: input.ruleset,
    stagePlayerIndices: input.stagePlayerIndices,
  })
  const { initialClients, playersToStage, gameId, planets, stagingPlanet } = initialClientsSetup1
  let { roleClients } = initialClientsSetup1
  if (input.targetOwnerFirst) {
    const ownerIndex = initialClients.findIndex(({ account }) => String(account.id) === String(stagingPlanet.ownerPlayerId))
    expect(ownerIndex).toBeGreaterThanOrEqual(0)
    const ownerClient = initialClients[ownerIndex]
    Assert.isDefined(ownerClient)
    roleClients = [ownerClient, ...initialClients.filter((_, index) => index !== ownerIndex)]
  }
  const playerIds = roleClients.map(({ account }) => branded<PlayerId>(account.id))
  const homes = playerIds.map((playerId) => {
    const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerId)
    Assert.isDefined(home)
    return home
  })

  await verifyRouteDistances({ ...input, ...initialClientsSetup1, homes, roleClients })
  const builtView = await roleClients[0]?.client.gameplay.getPlayerView.query({ gameId })
  Assert.isDefined(builtView)
  const builtFleets = homes.map((home, roleIndex) => {
    const playerId = playerIds[roleIndex]
    Assert.isDefined(playerId)
    const fleet = builtView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerId && originPlanetId === home.id && movement === undefined,
    )
    Assert.isDefined(fleet)
    return fleet
  })

  const stagingViewSetup2 = await createStagingViewSetup({ ...input, ...initialClientsSetup1, builtFleets, roleClients, homes, playerIds })
  const { stagingView } = stagingViewSetup2
  const stationed = playerIds.map((playerId, roleIndex) => {
    const home = homes[roleIndex]
    Assert.isDefined(home)
    const location = playersToStage.includes(roleIndex) ? stagingPlanet : home
    const fleet = stagingView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerId && originPlanetId === location.id && movement === undefined,
    )
    Assert.isDefined(fleet)
    expect(fleet.strength).toBe(input.forces[roleIndex])
    return fleet
  })

  return { clients: roleClients, playerIds, gameId, turnProcessor: input.turnProcessor, stagingPlanet, homes, stationed }
}

export type ThreeOwnerStationedAssaultFixture = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  gameId: number
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  target: PlayerView["galaxy"]["systems"][number]["planets"][number]
  homes: readonly [
    PlayerView["galaxy"]["systems"][number]["planets"][number],
    PlayerView["galaxy"]["systems"][number]["planets"][number],
    PlayerView["galaxy"]["systems"][number]["planets"][number],
  ]
  stationed: readonly [PlayerView["fleets"][number], PlayerView["fleets"][number], PlayerView["fleets"][number]]
}

async function verifyBobBuildRounds(input: VerifyBobBuildRoundsInput): Promise<void> {
  const bobBuildRounds = Math.ceil(Math.max(input.bobDepartureStrength, input.bobStartingStrength) / 10)
  for (let buildRound = 0; buildRound < Math.max(4, bobBuildRounds); buildRound += 1) {
    const views = await Promise.all(
      input.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
    )
    const aliceView = views[0]
    const bobView = views[1]
    Assert.isDefined(aliceView)
    Assert.isDefined(bobView)
    if (buildRound < 4) {
      await input.alice.client.gameplay.updateActionSubmission.mutate({
        gameId: input.gameId,
        turn: aliceView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(aliceView, BuildFleetStandard.id, { planet: input.aliceHome.id }),
      })
    }
    if (buildRound < bobBuildRounds) {
      await input.bob.client.gameplay.updateActionSubmission.mutate({
        gameId: input.gameId,
        turn: bobView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(bobView, BuildFleetStandard.id, { planet: input.bobHome.id }),
      })
    }
    await processPublicTurn({ ...input, turn: aliceView.turn })
  }
}

async function verifyActionSelections(input: VerifyActionSelectionsInput): Promise<void> {
  if (input.aliceDepartureStrength > 0) {
    await input.alice.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.aliceDepartureView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        input.aliceDepartureView,
        MoveFleetExceptional.id,
        { fleet: input.aliceBuilt.id, planet: input.bobHome.id },
        { strength: input.aliceDepartureStrength },
      ),
    })
  }
  if (input.bobDepartureStrength > 0) {
    await input.bob.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.bobDepartureView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        input.bobDepartureView,
        MoveFleetExceptional.id,
        { fleet: input.bobBuilt.id, planet: input.aliceHome.id },
        { strength: input.bobDepartureStrength },
      ),
    })
  }
  await processPublicTurn({ ...input, turn: input.aliceDepartureView.turn })
}

async function verifyRouteDistances(input: VerifyRouteDistancesInput): Promise<void> {
  const routeDistances = input.homes.map((home) => Math.hypot(home.x - input.stagingPlanet.x, home.y - input.stagingPlanet.y))
  expect(routeDistances).toStrictEqual([...input.expectedRouteDistances])

  // Arrange: build each requested force through actual public Build submissions and worker turns.
  const buildRounds = Math.max(...input.forces.map((strength) => Math.ceil(strength / 10)))
  for (let buildRound = 0; buildRound < buildRounds; buildRound += 1) {
    const views = await Promise.all(
      input.roleClients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
    )
    for (let roleIndex = 0; roleIndex < input.roleClients.length; roleIndex += 1) {
      const client = input.roleClients[roleIndex]
      const view = views[roleIndex]
      const home = input.homes[roleIndex]
      const force = input.forces[roleIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      Assert.isDefined(force)
      if (buildRound < Math.ceil(force / 10)) {
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId: input.gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
        })
      }
    }
    const view = views[0]
    Assert.isDefined(view)
    await processPublicTurn({ ...input, clients: input.roleClients, turn: view.turn })
  }
}

async function verifyRoleIndex(input: VerifyRoleIndexInput): Promise<void> {
  for (let roleIndex = 0; roleIndex < input.roleClients.length; roleIndex += 1) {
    if (!input.playersToStage.includes(roleIndex)) {
      continue
    }
    const client = input.roleClients[roleIndex]
    const view = input.departureViews[roleIndex]
    const home = input.homes[roleIndex]
    const fleet = input.builtFleets[roleIndex]
    const force = input.forces[roleIndex]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(home)
    Assert.isDefined(fleet)
    Assert.isDefined(force)
    if (home.id !== input.stagingPlanet.id) {
      await client.client.gameplay.updateActionSubmission.mutate({
        gameId: input.gameId,
        turn: view.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          view,
          MoveFleetExceptional.id,
          { fleet: fleet.id, planet: input.stagingPlanet.id },
          { strength: force },
        ),
      })
    }
  }
}

async function verifyPublicState({
  stagingView,
  firstAdvanceClient,
  gameId,
  playerIds,
  stagingPlanet,
  roleClients,
  turnProcessor,
}: VerifyPublicStateInput): Promise<VerifyPublicStateResult> {
  stagingView = await firstAdvanceClient.client.gameplay.getPlayerView.query({ gameId })
  for (let advance = 0; advance < 6; advance += 1) {
    const pendingArrivals = stagingView.fleets.filter(
      ({ ownerPlayerId, destinationPlanetId, movement }) =>
        playerIds.includes(ownerPlayerId) && destinationPlanetId === stagingPlanet.id && movement !== undefined,
    )
    if (pendingArrivals.length === 0) {
      break
    }
    await processPublicTurn({ clients: roleClients, gameId, turn: stagingView.turn, turnProcessor })
    const currentClient = roleClients[0]
    Assert.isDefined(currentClient)
    stagingView = await currentClient.client.gameplay.getPlayerView.query({ gameId })
  }
  expect(
    stagingView.fleets.some(
      ({ ownerPlayerId, destinationPlanetId, movement }) =>
        playerIds.includes(ownerPlayerId) && destinationPlanetId === stagingPlanet.id && movement !== undefined,
    ),
  ).toBe(false)

  return { stagingView }
}

type CreatePublicHomeArrivalFixtureInput = {
  db: Database
  clock: ControlledClock
  apiServer: ApiServer
  ruleset: Ruleset
  aliceDepartureStrength: number
  bobDepartureStrength: number
  bobStartingStrength?: number
}

type CreatePublicAssaultStagingFixtureInput = {
  apiServer: ApiServer
  clients: readonly AuthenticatedApiClient[]
  forces: readonly number[]
  stagingCoordinates: string
  targetOwnerFirst: boolean
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
  expectedRouteDistances: readonly number[]
  ruleset?: Ruleset
  stagePlayerIndices?: readonly number[]
}

type VerifyBobBuildRoundsInput = {
  bobDepartureStrength: number
  bobStartingStrength: number
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  alice: AuthenticatedApiClient
  aliceHome: Planet
  bob: AuthenticatedApiClient
  bobHome: Planet
  turnProcessor: TurnProcessor
}

type VerifyActionSelectionsInput = {
  aliceDepartureStrength: number
  alice: AuthenticatedApiClient
  gameId: GameId
  aliceDepartureView: PlayerView
  aliceBuilt: Fleet
  bobHome: Planet
  bobDepartureStrength: number
  bob: AuthenticatedApiClient
  bobDepartureView: PlayerView
  bobBuilt: Fleet
  aliceHome: Planet
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  turnProcessor: TurnProcessor
}

type VerifyRouteDistancesInput = {
  homes: Planet[]
  stagingPlanet: Planet
  expectedRouteDistances: readonly number[]
  forces: readonly number[]
  roleClients: AuthenticatedApiClient[]
  gameId: GameId
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
}

type VerifyRoleIndexInput = {
  roleClients: AuthenticatedApiClient[]
  playersToStage: readonly number[]
  departureViews: PlayerView[]
  homes: Planet[]
  builtFleets: Fleet[]
  forces: readonly number[]
  stagingPlanet: Planet
  gameId: GameId
}

type VerifyPublicStateInput = {
  stagingView: undefined | PlayerView
  firstAdvanceClient: AuthenticatedApiClient
  gameId: GameId
  playerIds: PlayerId[]
  stagingPlanet: Planet
  roleClients: AuthenticatedApiClient[]
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
}

type VerifyPublicStateResult = { stagingView: undefined | PlayerView }

function stationaryHomeFleet(
  view: PlayerView,
  owner: PlayerId,
  planet: PlayerView["fleets"][number]["originPlanetId"],
): PlayerView["fleets"][number] | undefined {
  return view.fleets.find((fleet) => fleet.ownerPlayerId === owner && fleet.originPlanetId === planet && fleet.movement === undefined)
}

async function createInitialClientsSetup(input: CreateInitialClientsSetupInput): Promise<CreateInitialClientsSetupResult> {
  const initialClients = input.availableClients.slice(0, input.forces.length)
  const gameRuleset = input.ruleset ?? AssaultWorkerRuleset
  const playersToStage = input.stagePlayerIndices ?? input.forces.map((_, index) => index)
  const host = initialClients[0]
  Assert.isDefined(host)
  const { createdGameId: gameId } = await host.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: gameRuleset.id,
      nbSeats: input.forces.length,
      turnIntervalSeconds: Time.in(Time.create(10, UnitOfTime.SECONDS), UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  for (const joiningClient of initialClients.slice(1)) {
    await joiningClient.client.games.join.mutate({ gameId })
  }
  await host.client.games.startGame.mutate({ gameId })
  const initialView = await host.client.gameplay.getPlayerView.query({ gameId })
  const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const stagingPlanet = planets.find(({ coordinates }) => coordinates === input.stagingCoordinates)
  Assert.isDefined(stagingPlanet)

  // Arrange: role A owns the fixed target for two-seat stationary controls; three-seat roles retain caller order.
  const roleClients = [...initialClients]
  return { initialClients, playersToStage, gameId, planets, stagingPlanet, roleClients }
}

async function createStagingViewSetup(input: CreateStagingViewSetupInput): Promise<CreateStagingViewSetupResult> {
  expect(input.builtFleets.map(({ strength }) => strength)).toStrictEqual(input.forces.map((strength) => Math.ceil(strength / 10) * 10))

  // Act: stage each role's literal selected force at the named public planet through ordinary Move submissions.
  const departureViews = await Promise.all(
    input.roleClients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
  )

  await verifyRoleIndex({ ...input, departureViews })
  let stagingView = departureViews[0]
  Assert.isDefined(stagingView)
  await processPublicTurn({ ...input, clients: input.roleClients, turn: stagingView.turn })
  const firstAdvanceClient = input.roleClients[0]
  Assert.isDefined(firstAdvanceClient)

  const updatedVerifyPublicState = await verifyPublicState({ ...input, stagingView, firstAdvanceClient })
  stagingView = updatedVerifyPublicState.stagingView
  Assert.isDefined(stagingView)
  return { stagingView }
}

type CreateInitialClientsSetupInput = {
  availableClients: readonly AuthenticatedApiClient[]
  forces: readonly number[]
  ruleset: undefined | Ruleset
  stagePlayerIndices: undefined | readonly number[]
  stagingCoordinates: string
}

type CreateInitialClientsSetupResult = {
  initialClients: AuthenticatedApiClient[]
  playersToStage: readonly number[]
  gameId: GameId
  planets: Planet[]
  stagingPlanet: Planet
  roleClients: AuthenticatedApiClient[]
}

type CreateStagingViewSetupInput = {
  builtFleets: Fleet[]
  forces: readonly number[]
  roleClients: AuthenticatedApiClient[]
  gameId: GameId
  playersToStage: readonly number[]
  homes: Planet[]
  stagingPlanet: Planet
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
  playerIds: PlayerId[]
}

type CreateStagingViewSetupResult = { stagingView: PlayerView }
