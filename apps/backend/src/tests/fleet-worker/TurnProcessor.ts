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
  // Arrange: establish the fixed seed-147 home pair through the public game lifecycle.
  const alice = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
  const bob = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
  const clients = [alice, bob] as const
  const playerIds = [branded<PlayerId>(alice.account.id), branded<PlayerId>(bob.account.id)] as const
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: ruleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(Time.create(10, UnitOfTime.SECONDS), UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
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

  // Arrange: use public Build submissions and real worker turns to create Alice40 and Bob's requested defender force.

  await verifyBobBuildRounds({ bobDepartureStrength, bobStartingStrength, clients, gameId, alice, aliceHome, bob, bobHome, turnProcessor })
  const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const aliceBuilt = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[0] && originPlanetId === aliceHome.id && movement === undefined,
  )
  const bobBuilt = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[1] && originPlanetId === bobHome.id && movement === undefined,
  )
  Assert.isDefined(aliceBuilt)
  Assert.isDefined(bobBuilt)
  expect(aliceBuilt.strength).toBe(40)
  expect(bobBuilt.strength).toBe(Math.ceil(Math.max(bobDepartureStrength, bobStartingStrength) / 10) * 10)

  // Act: stage Alice's source at Bob's home and Bob's defending force at Alice's home with public exceptional Moves.
  const departureViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
  const aliceDepartureView = departureViews[0]
  const bobDepartureView = departureViews[1]
  Assert.isDefined(aliceDepartureView)
  Assert.isDefined(bobDepartureView)

  await verifyActionSelections({
    aliceDepartureStrength,
    alice,
    gameId,
    aliceDepartureView,
    aliceBuilt,
    bobHome,
    bobDepartureStrength,
    bob,
    bobDepartureView,
    bobBuilt,
    aliceHome,
    clients,
    turnProcessor,
  })
  const stagedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const aliceAtSource = stagedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[0] && originPlanetId === bobHome.id && movement === undefined,
  )
  const aliceAtTarget = stagedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[0] && originPlanetId === aliceHome.id && movement === undefined,
  )
  const bobAtSource = stagedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[1] && originPlanetId === bobHome.id && movement === undefined,
  )
  const bobAtTarget = stagedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[1] && originPlanetId === aliceHome.id && movement === undefined,
  )
  if (aliceDepartureStrength === 0) {
    expect(aliceAtSource).toBeUndefined()
    expect(aliceAtTarget).toMatchObject({ strength: 40 })
  } else {
    Assert.isDefined(aliceAtSource)
    expect(aliceAtSource.strength).toBe(aliceDepartureStrength)
    if (aliceDepartureStrength === 40) {
      expect(aliceAtTarget).toBeUndefined()
    } else {
      expect(aliceAtTarget?.strength).toBe(40 - aliceDepartureStrength)
    }
  }
  Assert.isDefined(bobAtTarget)
  expect(bobAtTarget.strength).toBe(bobDepartureStrength)
  if (bobStartingStrength > bobDepartureStrength) {
    Assert.isDefined(bobAtSource)
    expect(bobAtSource.strength).toBe(Math.ceil(bobStartingStrength / 10) * 10 - bobDepartureStrength)
  }
  return {
    clients,
    playerIds,
    gameId,
    turnProcessor,
    turnsRepository,
    aliceHome,
    bobHome,
    aliceAtSource,
    aliceAtTarget,
    bobAtSource,
    bobAtTarget,
    distance: 4.418312565270031,
  }
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

export async function createPublicAssaultStagingFixture({
  clients: availableClients,
  forces,
  stagingCoordinates,
  targetOwnerFirst,
  turnProcessor,
  expectedRouteDistances,
  ruleset,
  stagePlayerIndices,
}: CreatePublicAssaultStagingFixtureInput): Promise<PublicAssaultStagingFixture> {
  // Arrange: create/join/start a fresh fixed-seed game exclusively through the public API.
  const initialClients = availableClients.slice(0, forces.length)
  const gameRuleset = ruleset ?? AssaultWorkerRuleset
  const playersToStage = stagePlayerIndices ?? forces.map((_, index) => index)
  const host = initialClients[0]
  Assert.isDefined(host)
  const { createdGameId: gameId } = await host.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: gameRuleset.id,
      nbSeats: forces.length,
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
  const stagingPlanet = planets.find(({ coordinates }) => coordinates === stagingCoordinates)
  Assert.isDefined(stagingPlanet)

  // Arrange: role A owns the fixed target for two-seat stationary controls; three-seat roles retain caller order.
  let roleClients = [...initialClients]
  if (targetOwnerFirst) {
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

  await verifyRouteDistances({ homes, stagingPlanet, expectedRouteDistances, forces, roleClients, gameId, turnProcessor })
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
  expect(builtFleets.map(({ strength }) => strength)).toStrictEqual(forces.map((strength) => Math.ceil(strength / 10) * 10))

  // Act: stage each role's literal selected force at the named public planet through ordinary Move submissions.
  const departureViews = await Promise.all(roleClients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))

  await verifyRoleIndex({ roleClients, playersToStage, departureViews, homes, builtFleets, forces, stagingPlanet, gameId })
  let stagingView = departureViews[0]
  Assert.isDefined(stagingView)
  await processPublicTurn({ clients: roleClients, gameId, turn: stagingView.turn, turnProcessor })
  const firstAdvanceClient = roleClients[0]
  Assert.isDefined(firstAdvanceClient)

  const updatedVerifyPublicState = await verifyPublicState({
    stagingView,
    firstAdvanceClient,
    gameId,
    playerIds,
    stagingPlanet,
    roleClients,
    turnProcessor,
  })
  stagingView = updatedVerifyPublicState.stagingView
  Assert.isDefined(stagingView)
  const stationed = playerIds.map((playerId, roleIndex) => {
    const home = homes[roleIndex]
    Assert.isDefined(home)
    const location = playersToStage.includes(roleIndex) ? stagingPlanet : home
    const fleet = stagingView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerId && originPlanetId === location.id && movement === undefined,
    )
    Assert.isDefined(fleet)
    expect(fleet.strength).toBe(forces[roleIndex])
    return fleet
  })

  return { clients: roleClients, playerIds, gameId, turnProcessor, stagingPlanet, homes, stationed }
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

async function verifyBobBuildRounds({
  bobDepartureStrength,
  bobStartingStrength,
  clients,
  gameId,
  alice,
  aliceHome,
  bob,
  bobHome,
  turnProcessor,
}: VerifyBobBuildRoundsInput): Promise<void> {
  const bobBuildRounds = Math.ceil(Math.max(bobDepartureStrength, bobStartingStrength) / 10)
  for (let buildRound = 0; buildRound < Math.max(4, bobBuildRounds); buildRound += 1) {
    const views = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    const aliceView = views[0]
    const bobView = views[1]
    Assert.isDefined(aliceView)
    Assert.isDefined(bobView)
    if (buildRound < 4) {
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: aliceView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(aliceView, BuildFleetStandard.id, { planet: aliceHome.id }),
      })
    }
    if (buildRound < bobBuildRounds) {
      await bob.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: bobView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(bobView, BuildFleetStandard.id, { planet: bobHome.id }),
      })
    }
    await processPublicTurn({ clients, gameId, turn: aliceView.turn, turnProcessor })
  }
}

async function verifyActionSelections({
  aliceDepartureStrength,
  alice,
  gameId,
  aliceDepartureView,
  aliceBuilt,
  bobHome,
  bobDepartureStrength,
  bob,
  bobDepartureView,
  bobBuilt,
  aliceHome,
  clients,
  turnProcessor,
}: VerifyActionSelectionsInput): Promise<void> {
  if (aliceDepartureStrength > 0) {
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: aliceDepartureView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        aliceDepartureView,
        MoveFleetExceptional.id,
        { fleet: aliceBuilt.id, planet: bobHome.id },
        { strength: aliceDepartureStrength },
      ),
    })
  }
  if (bobDepartureStrength > 0) {
    await bob.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: bobDepartureView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        bobDepartureView,
        MoveFleetExceptional.id,
        { fleet: bobBuilt.id, planet: aliceHome.id },
        { strength: bobDepartureStrength },
      ),
    })
  }
  await processPublicTurn({ clients, gameId, turn: aliceDepartureView.turn, turnProcessor })
}

async function verifyRouteDistances({
  homes,
  stagingPlanet,
  expectedRouteDistances,
  forces,
  roleClients,
  gameId,
  turnProcessor,
}: VerifyRouteDistancesInput): Promise<void> {
  const routeDistances = homes.map((home) => Math.hypot(home.x - stagingPlanet.x, home.y - stagingPlanet.y))
  expect(routeDistances).toStrictEqual([...expectedRouteDistances])

  // Arrange: build each requested force through actual public Build submissions and worker turns.
  const buildRounds = Math.max(...forces.map((strength) => Math.ceil(strength / 10)))
  for (let buildRound = 0; buildRound < buildRounds; buildRound += 1) {
    const views = await Promise.all(roleClients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    for (let roleIndex = 0; roleIndex < roleClients.length; roleIndex += 1) {
      const client = roleClients[roleIndex]
      const view = views[roleIndex]
      const home = homes[roleIndex]
      const force = forces[roleIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      Assert.isDefined(force)
      if (buildRound < Math.ceil(force / 10)) {
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
        })
      }
    }
    const view = views[0]
    Assert.isDefined(view)
    await processPublicTurn({ clients: roleClients, gameId, turn: view.turn, turnProcessor })
  }
}

async function verifyRoleIndex({
  roleClients,
  playersToStage,
  departureViews,
  homes,
  builtFleets,
  forces,
  stagingPlanet,
  gameId,
}: VerifyRoleIndexInput): Promise<void> {
  for (let roleIndex = 0; roleIndex < roleClients.length; roleIndex += 1) {
    if (!playersToStage.includes(roleIndex)) {
      continue
    }
    const client = roleClients[roleIndex]
    const view = departureViews[roleIndex]
    const home = homes[roleIndex]
    const fleet = builtFleets[roleIndex]
    const force = forces[roleIndex]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(home)
    Assert.isDefined(fleet)
    Assert.isDefined(force)
    if (home.id !== stagingPlanet.id) {
      await client.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          view,
          MoveFleetExceptional.id,
          { fleet: fleet.id, planet: stagingPlanet.id },
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
