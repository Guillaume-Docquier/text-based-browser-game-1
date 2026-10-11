import { Assert, branded, type DeepUnbranded, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { NonNegativeSafeIntegerSchema } from "shared/domain/NonNegativeSafeInteger.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import { FleetAssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { describe, expect, it } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { GameId, PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { actionsTable, fleetsTable, planetsTable, resourcesTable, turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

const TURN_INTERVAL = Time.create(10, UnitOfTime.SECONDS)
const MANUAL_WORKER_TURN_INTERVAL = Time.create(1, UnitOfTime.HOURS)
const MANUAL_WORKER_CLOCK_ADVANCE = Time.create(2, UnitOfTime.HOURS)
const RULESET_ID_FOR_STRENGTH_RACES = "test_strength_concurrency"
const RULESET_ID_FOR_RESOURCE_RACE = "test_resource_concurrency"

const PostgresArrivalAssaultRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_postgres_arrival_assault",
  name: "PostgreSQL Arrival Assault Test",
  actionPool: [...TestRuleset.actionPool, { id: "TEST_ATTACK_MOVE_2", actionDefinitionId: AttackMoveTest.id }],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

type CapturedAssaultMovement = NonNullable<PlayerView["fleets"][number]["movement"]>

type PendingAssaultCorruption = {
  label: string
  expectedFailedTurnStatus: typeof TurnStatus.PROCESSING | typeof TurnStatus.AWAITING_PROCESSING
  corruptMovement: (movement: CapturedAssaultMovement, otherPlayerId: PlayerView["player"]["id"]) => CapturedAssaultMovement
}

const pendingAssaultCorruptions: readonly PendingAssaultCorruption[] = [
  {
    label: "pending ordinal",
    expectedFailedTurnStatus: TurnStatus.PROCESSING,
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect, index) =>
        index === 0 ? { ...pendingEffect, definitionOrdinal: NonNegativeSafeIntegerSchema.parse(2) } : pendingEffect,
      ),
    }),
  },
  {
    label: "pending Assault mapping",
    expectedFailedTurnStatus: TurnStatus.PROCESSING,
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect, index) =>
        index === 0
          ? {
              ...pendingEffect,
              effectDefinition: FleetAssaultEffectDefinition.create({ fleetTag: "wrongForce", planetTag: "wrongSite" }),
            }
          : pendingEffect,
      ),
    }),
  },
  {
    label: "captured journey owner binding",
    expectedFailedTurnStatus: TurnStatus.AWAITING_PROCESSING,
    corruptMovement: (movement, otherPlayerId) => ({
      ...movement,
      submission: { ...movement.submission, playerId: otherPlayerId },
    }),
  },
  {
    label: "captured Action Definition binding",
    expectedFailedTurnStatus: TurnStatus.PROCESSING,
    corruptMovement: (movement) => ({
      ...movement,
      submission: { ...movement.submission, actionDefinitionId: MoveFleetExceptional.id },
    }),
  },
]

type PublicPendingAssaultFixture = {
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  alicePlayerId: PlayerView["player"]["id"]
  bobPlayerId: PlayerView["player"]["id"]
  gameId: GameId
  aliceSource: PlayerView["fleets"][number]
  bobHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
  pendingView: PlayerView
  capturedJourney: PlayerView["fleets"][number]
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  clock: ControlledClock
}

async function createPublicPendingAssaultFixture(server: ConcurrencyTestApiServer): Promise<PublicPendingAssaultFixture> {
  const clock = new ControlledClock({ startDate: new Date() })
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresArrivalAssaultRuleset))
  const alice = await server.createClient({ authenticated: true })
  const bob = await server.createClient({ authenticated: true })
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PostgresArrivalAssaultRuleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

  const processDeadlineTurn = async (turn: number): Promise<void> => {
    await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn })
  }

  const aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
  const planets = aliceView.galaxy.systems.flatMap(({ planets }) => planets)
  const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === aliceView.player.id)
  const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
  Assert.isDefined(aliceHome)
  Assert.isDefined(bobHome)
  expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
  expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

  const buildAction = aliceView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
  Assert.isDefined(buildAction)
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: aliceView.turn,
    submittedActionTargets: { actionId: buildAction.id, selectedTargets: { planet: aliceHome.id }, selectedInputs: {} },
  })
  await processDeadlineTurn(aliceView.turn)

  const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const aliceSource = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === builtView.player.id && originPlanetId === aliceHome.id && movement === undefined,
  )
  Assert.isDefined(aliceSource)
  expect(aliceSource.strength).toBe(10)

  const attackAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
  Assert.isDefined(attackAction)
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: builtView.turn,
    submittedActionTargets: {
      actionId: attackAction.id,
      selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
      selectedInputs: { strength: 1 },
    },
  })
  const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 98, uncommitted: 93 })
  expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 99 })
  expect(selectedView.resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  await processDeadlineTurn(builtView.turn)

  const pendingView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const capturedJourney = pendingView.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
  Assert.isDefined(capturedJourney)
  expect(capturedJourney).toMatchObject({
    strength: 1,
    destinationPlanetId: bobHome.id,
    distanceToEnd: 3.418312565270031,
    movement: {
      speed: 1,
      submission: {
        id: attackAction.id,
        playerId: aliceView.player.id,
        actionDefinitionId: AttackMoveTest.id,
        selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
        selectedInputs: { strength: 1 },
      },
      pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }],
    },
  })
  expect(pendingView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 93, uncommitted: 93 })
  expect(pendingView.resources[ResourceType.FUEL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(pendingView.resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(pendingView.actions.find(({ id }) => id === attackAction.id)?.isInProgress).toBe(true)
  expect(pendingView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(9)

  return {
    alice,
    bob,
    alicePlayerId: aliceView.player.id,
    bobPlayerId: bobView.player.id,
    gameId,
    aliceSource,
    bobHome,
    pendingView,
    capturedJourney,
    turnProcessor,
    turnsRepository,
    clock,
  }
}

type GameplayRowsSnapshot = {
  fleets: Array<typeof fleetsTable.$inferSelect>
  resources: Array<typeof resourcesTable.$inferSelect>
  planets: Array<typeof planetsTable.$inferSelect>
  actions: Array<typeof actionsTable.$inferSelect>
}

function sortGameplayRows<Row>(rows: Row[]): Row[] {
  return rows.toSorted((left, right) => compareOrdinalStrings(JSON.stringify(left) ?? "", JSON.stringify(right) ?? ""))
}

function findUnoccupiedUnclaimedAssaultDestination(
  view: PlayerView,
  source: PlayerView["galaxy"]["systems"][number]["planets"][number],
  excludedPlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
): PlayerView["galaxy"]["systems"][number]["planets"][number] | undefined {
  return view.galaxy.systems
    .flatMap(({ planets }) => planets)
    .find((planet) => {
      const distance = Math.hypot(planet.x - source.x, planet.y - source.y)
      const isUnclaimed = planet.ownerPlayerId === null || planet.ownerPlayerId === undefined
      const isUnoccupied = view.fleets.every(
        ({ originPlanetId, destinationPlanetId }) => originPlanetId !== planet.id && destinationPlanetId !== planet.id,
      )
      return isUnclaimed && planet.id !== excludedPlanetId && distance > 4.418312565270031 && distance <= 5 && isUnoccupied
    })
}

describe("gameplay submission concurrency", () => {
  it("should persist an Assault arrival, remove defeated rows, and merge survivors on fresh PostgreSQL", async () => {
    // Arrange: the real API process migrates and seeds a fresh PostgreSQL 18.4 database before public game setup.
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresArrivalAssaultRuleset))
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PostgresArrivalAssaultRuleset.id,
        nbSeats: 2,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 147,
      }),
    })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    const submit = async ({
      client,
      view,
      actionDefinitionId,
      selectedTargets,
      selectedInputs,
    }: {
      client: AuthenticatedApiClient["client"]
      view: PlayerView
      actionDefinitionId: ActionDefinitionId
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>
    }): Promise<string> => {
      const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
      Assert.isDefined(action)
      await client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
      })
      return action.id
    }

    const processDeadlineTurn = async (turn: number): Promise<void> => {
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn })
    }

    const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const allPlanets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
    const aliceHome = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
    const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
    const bobHome = bobView.galaxy.systems
      .flatMap(({ planets }) => planets)
      .find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
    Assert.isDefined(aliceHome)
    Assert.isDefined(bobHome)
    expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
    expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

    // Act: create forces through submitted Build actions and actual saved worker turns.
    for (let buildTurn = 0; buildTurn < 2; buildTurn += 1) {
      const aliceBuildView = await alice.client.gameplay.getPlayerView.query({ gameId })
      const bobBuildView = await bob.client.gameplay.getPlayerView.query({ gameId })
      await submit({
        client: alice.client,
        view: aliceBuildView,
        actionDefinitionId: BuildFleetStandard.id,
        selectedTargets: { planet: aliceHome.id },
        selectedInputs: {},
      })
      await submit({
        client: bob.client,
        view: bobBuildView,
        actionDefinitionId: BuildFleetStandard.id,
        selectedTargets: { planet: bobHome.id },
        selectedInputs: {},
      })
      await processDeadlineTurn(aliceBuildView.turn)
    }
    for (let buildTurn = 0; buildTurn < 3; buildTurn += 1) {
      const aliceBuildView = await alice.client.gameplay.getPlayerView.query({ gameId })
      await submit({
        client: alice.client,
        view: aliceBuildView,
        actionDefinitionId: BuildFleetStandard.id,
        selectedTargets: { planet: aliceHome.id },
        selectedInputs: {},
      })
      await processDeadlineTurn(aliceBuildView.turn)
    }

    const readyView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const aliceSource = readyView.fleets
      .filter(({ ownerPlayerId }) => ownerPlayerId === readyView.player.id)
      .filter(({ originPlanetId }) => originPlanetId === aliceHome.id)
      .find(({ movement }) => movement === undefined)
    const bobDefender = readyView.fleets
      .filter(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
      .filter(({ originPlanetId }) => originPlanetId === bobHome.id)
      .find(({ movement }) => movement === undefined)
    Assert.isDefined(aliceSource)
    Assert.isDefined(bobDefender)
    expect(aliceSource.strength).toBe(50)
    expect(bobDefender.strength).toBe(20)

    // Arrange: move a seven-strength friendly fleet to the target through a public action for the merge survivor.
    await submit({
      client: alice.client,
      view: readyView,
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
      selectedInputs: { strength: 7 },
    })
    const guardDeparture = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(guardDeparture.resources[ResourceType.INFLUENCE].uncommitted).toBe(87)
    expect(guardDeparture.resources[ResourceType.FUEL].uncommitted).toBe(95)
    await processDeadlineTurn(readyView.turn)
    const guardArrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const friendlyGuard = guardArrivalView.fleets
      .filter(({ ownerPlayerId }) => ownerPlayerId === readyView.player.id)
      .filter(({ originPlanetId }) => originPlanetId === bobHome.id)
      .filter(({ strength }) => strength === 7)
      .find(({ movement }) => movement === undefined)
    Assert.isDefined(friendlyGuard)
    expect(friendlyGuard).toMatchObject({ strength: 7, originPlanetId: bobHome.id })
    expect(guardArrivalView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
    const sourceAfterGuard = guardArrivalView.fleets.find(({ id }) => id === aliceSource.id)
    Assert.isDefined(sourceAfterGuard)
    expect(sourceAfterGuard.strength).toBe(43)

    // Act: submit partial Attack Move, then inspect persisted movement JSON after each actual worker reload.
    const assaultActionId = await submit({
      client: alice.client,
      view: guardArrivalView,
      actionDefinitionId: AttackMoveTest.id,
      selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
      selectedInputs: { strength: 30 },
    })
    const assaultSelectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(assaultSelectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 87, uncommitted: 82 })
    expect(assaultSelectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 94 })
    expect(assaultSelectedView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(43)

    await processDeadlineTurn(guardArrivalView.turn)
    const firstReload = await alice.client.gameplay.getPlayerView.query({ gameId })
    const journey = firstReload.fleets.find(({ movement }) => movement?.submission.id === assaultActionId)
    Assert.isDefined(journey)
    expect(journey).toMatchObject({ strength: 30, distanceToEnd: 3.418312565270031, destinationPlanetId: bobHome.id })
    expect(journey.movement).toMatchObject({
      speed: 1,
      submission: {
        id: assaultActionId,
        actionDefinitionId: AttackMoveTest.id,
        selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
        selectedInputs: { strength: 30 },
      },
      pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }],
    })
    expect(firstReload.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
    expect(firstReload.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(7)
    expect(firstReload.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(13)
    // Assert: the new collecting-turn row is blank while the journey retains its historical captured submission.
    expect(firstReload.actions.find(({ id }) => id === assaultActionId)).toMatchObject({
      selectedTargets: null,
      selectedInputs: null,
      isInProgress: true,
    })
    expect(firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 82, uncommitted: 82 })
    expect(firstReload.resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 94 })

    // Assert: every edit form of the captured instance is rejected with the complete public state unchanged.
    const alternateDestination = findUnoccupiedUnclaimedAssaultDestination(firstReload, aliceHome, bobHome.id)
    Assert.isDefined(alternateDestination)
    const alternateDistance = Math.hypot(alternateDestination.x - aliceHome.x, alternateDestination.y - aliceHome.y)
    expect(alternateDistance).toBeGreaterThan(4.418312565270031)
    expect(alternateDistance).toBeLessThanOrEqual(5)
    const rejectBusySubmission = async (
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
    ): Promise<void> => {
      await expect(
        alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: firstReload.turn,
          submittedActionTargets: { actionId: assaultActionId, selectedTargets, selectedInputs },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(firstReload)
    }
    await rejectBusySubmission({ fleet: aliceSource.id, planet: bobHome.id }, { strength: 29 })
    await rejectBusySubmission(null, null)
    await rejectBusySubmission({ fleet: aliceSource.id, planet: alternateDestination.id }, { strength: 29 })
    await rejectBusySubmission({ fleet: aliceSource.id, planet: bobHome.id }, { strength: 13 })

    // Act: a distinct pooled instance moves one source remainder to another legal public destination.
    const remainderAction = firstReload.actions.find(({ id }) => id === "TEST_ATTACK_MOVE_2")
    Assert.isDefined(remainderAction)
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: firstReload.turn,
      submittedActionTargets: {
        actionId: remainderAction.id,
        selectedTargets: { fleet: aliceSource.id, planet: alternateDestination.id },
        selectedInputs: { strength: 1 },
      },
    })
    const remainderSelectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(remainderSelectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 82, uncommitted: 77 })
    expect(remainderSelectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 93 })

    const expectedRemainders = [2.418312565270031, 1.418312565270031, 0.418312565270031]
    const advanceRemainderTurn = async (currentView: PlayerView, expectedRemainder: number): Promise<PlayerView> => {
      await processDeadlineTurn(currentView.turn)
      const nextView = await alice.client.gameplay.getPlayerView.query({ gameId })
      expect(nextView.fleets.find(({ id }) => id === journey.id)?.distanceToEnd).toBe(expectedRemainder)
      expect(nextView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
      expect(nextView.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(7)
      expect(nextView.actions.find(({ id }) => id === assaultActionId)?.isInProgress).toBe(true)
      expect(nextView.actions.find(({ id }) => id === remainderAction.id)?.isInProgress).toBe(true)
      expect(nextView.resources[ResourceType.INFLUENCE].total).toBe(77)
      expect(nextView.resources[ResourceType.FUEL].total).toBe(93)
      expect(nextView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(12)
      return nextView
    }
    const [firstExpectedRemainder, ...laterExpectedRemainders] = expectedRemainders
    Assert.isDefined(firstExpectedRemainder)
    let savedView = await advanceRemainderTurn(remainderSelectedView, firstExpectedRemainder)
    const remainderJourney = savedView.fleets.find(({ movement }) => movement?.submission.id === remainderAction.id)
    Assert.isDefined(remainderJourney)
    const remainderJourneyId = remainderJourney.id
    const remainderJourneyName = remainderJourney.name
    expect(remainderJourney).toMatchObject({
      strength: 1,
      originPlanetId: aliceHome.id,
      destinationPlanetId: alternateDestination.id,
      movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
    })
    expect(remainderJourney.distanceToEnd).toBeCloseTo(alternateDistance - 1, 12)
    for (const expectedRemainder of laterExpectedRemainders) {
      savedView = await advanceRemainderTurn(savedView, expectedRemainder)
    }

    await processDeadlineTurn(savedView.turn)
    const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })

    // Assert: zero-strength enemy and merged incoming rows disappear; the named friendly survivor keeps its identity.
    expect(arrivalView.fleets.find(({ id }) => id === bobDefender.id)).toBeUndefined()
    expect(arrivalView.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
    expect(arrivalView.fleets.find(({ id }) => id === friendlyGuard.id)).toStrictEqual({
      id: friendlyGuard.id,
      name: friendlyGuard.name,
      ownerPlayerId: readyView.player.id,
      strength: 17,
      originPlanetId: bobHome.id,
    })
    expect(arrivalView.fleets.find(({ id }) => id === aliceSource.id)).toMatchObject({ strength: 12, originPlanetId: aliceHome.id })
    expect(arrivalView.actions.find(({ id }) => id === assaultActionId)?.isInProgress).toBe(false)
    Assert.isDefined(remainderJourneyId)
    Assert.isDefined(remainderJourneyName)
    expect(arrivalView.actions.find(({ id }) => id === remainderAction.id)?.isInProgress).toBe(true)
    const remainderAtAssaultArrival = arrivalView.fleets.find(({ id }) => id === remainderJourneyId)
    Assert.isDefined(remainderAtAssaultArrival)
    expect(remainderAtAssaultArrival).toMatchObject({
      id: remainderJourneyId,
      name: remainderJourneyName,
      ownerPlayerId: readyView.player.id,
      strength: 1,
      originPlanetId: aliceHome.id,
      destinationPlanetId: alternateDestination.id,
      movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
    })
    expect(remainderAtAssaultArrival.distanceToEnd).toBeGreaterThan(0)
    expect(remainderAtAssaultArrival.distanceToEnd).toBeLessThanOrEqual(1)
    expect(arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 77, uncommitted: 77 })
    expect(arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 93, uncommitted: 93 })

    // The later empty-destination arrival keeps the same child and releases its own pooled instance.
    await processDeadlineTurn(arrivalView.turn)
    const afterRemainderArrival = await alice.client.gameplay.getPlayerView.query({ gameId })
    const stationaryRemainder = afterRemainderArrival.fleets.find(({ id }) => id === remainderJourneyId)
    Assert.isDefined(stationaryRemainder)
    expect(stationaryRemainder).toMatchObject({
      id: remainderJourneyId,
      name: remainderJourneyName,
      ownerPlayerId: readyView.player.id,
      strength: 1,
      originPlanetId: alternateDestination.id,
    })
    expect(stationaryRemainder.movement).toBeUndefined()
    expect(stationaryRemainder.destinationPlanetId).toBeUndefined()
    expect(afterRemainderArrival.actions.find(({ id }) => id === remainderAction.id)?.isInProgress).toBe(false)
    expect(afterRemainderArrival.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(17)

    await processDeadlineTurn(afterRemainderArrival.turn)
    const afterEmptyTurn = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(afterEmptyTurn.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(17)
    expect(afterEmptyTurn.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
    expect(afterEmptyTurn.fleets.find(({ id }) => id === stationaryRemainder.id)).toStrictEqual(stationaryRemainder)
    expect(afterEmptyTurn.fleets.find(({ id }) => id === bobDefender.id)).toBeUndefined()
    expect(afterEmptyTurn.actions.find(({ id }) => id === assaultActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(afterEmptyTurn.resources[ResourceType.INFLUENCE].total).toBe(77)
    expect(afterEmptyTurn.resources[ResourceType.FUEL].total).toBe(93)
    expect(afterEmptyTurn.actions.find(({ id }) => id === remainderAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
  })

  it.each(pendingAssaultCorruptions)(
    "should reject a persisted $label before gameplay mutation on fresh PostgreSQL",
    async ({ corruptMovement, expectedFailedTurnStatus }) => {
      // Arrange: this isolated database receives a genuine public game, Build, and captured partial Attack Move.
      await using server = await ConcurrencyTestApiServer.create()
      const fixture = await createPublicPendingAssaultFixture(server)
      const { alicePlayerId, bobPlayerId, gameId, pendingView, capturedJourney, turnProcessor, turnsRepository, clock } = fixture

      const persistedJourney = (await server.database.select().from(fleetsTable).where(eq(fleetsTable.id, capturedJourney.id)))[0]
      Assert.isDefined(persistedJourney)
      Assert.isDefined(persistedJourney.movement)
      expect(persistedJourney.movement).toStrictEqual(capturedJourney.movement)
      expect(persistedJourney.ownerPlayerId).toBe(alicePlayerId)

      // Only the authentic captured movement JSON is fault-injected; fleet row ownership and gameplay setup stay public and intact.
      const corruptMovementValue = corruptMovement(persistedJourney.movement, bobPlayerId)
      await server.database.update(fleetsTable).set({ movement: corruptMovementValue }).where(eq(fleetsTable.id, capturedJourney.id))

      await markManualDeadlineDue({ clock, turnsRepository })

      const dueTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      const dueTurn = dueTurns.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(dueTurn)
      expect(dueTurn.status).toBe(TurnStatus.AWAITING_PROCESSING)
      expect(dueTurns.map(({ turn }) => turn)).toContain(pendingView.turn)

      const snapshotGameplayRows = async (): Promise<GameplayRowsSnapshot> => {
        const [fleets, resources, planets, actions] = await Promise.all([
          server.database.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)),
          server.database.select().from(resourcesTable).where(eq(resourcesTable.gameId, gameId)),
          server.database.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)),
          server.database.select().from(actionsTable).where(eq(actionsTable.gameId, gameId)),
        ])
        return {
          fleets: sortGameplayRows(fleets),
          resources: sortGameplayRows(resources),
          planets: sortGameplayRows(planets),
          actions: sortGameplayRows(actions),
        }
      }
      const gameplayBeforeFailure = await snapshotGameplayRows()
      const turnCountBeforeFailure = dueTurns.length

      // Act: the actual TurnProcessor loads the persisted invalid journey and rejects this exact due turn.
      expect(await turnProcessor.processNextDueTurn()).toBe("failed")

      // Assert: gameplay rows match the pre-worker snapshot, and the exact target turn remains in processing.
      expect(await snapshotGameplayRows()).toStrictEqual(gameplayBeforeFailure)
      const turnsAfterFailure = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      expect(turnsAfterFailure).toHaveLength(turnCountBeforeFailure)
      const failedTargetTurn = turnsAfterFailure.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(failedTargetTurn)
      expect(failedTargetTurn.status).toBe(expectedFailedTurnStatus)
    },
  )

  it("should serialize real PostgreSQL resource and fleet-strength reservations and round-trip departures", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(StrengthRaceRuleset))
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(ResourceRaceRuleset))
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: strengthGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: StrengthRaceRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: strengthGameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    // Build a strength-50 source Fleet using the public API and real PostgreSQL turn persistence.
    let playerView = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const origin = playerView.galaxy.systems
      .flatMap(({ planets }) => planets)
      .find(({ ownerPlayerId }) => ownerPlayerId === playerView.player.id)
    const destination = playerView.galaxy.systems.flatMap(({ planets }) => planets).find(({ coordinates }) => coordinates === "55:07:50")
    Assert.isDefined(origin)
    Assert.isDefined(destination)
    for (let buildCount = 0; buildCount < 5; buildCount += 1) {
      const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: strengthGameId,
        turn: playerView.turn,
        submittedActionTargets: {
          actionId: buildAction.id,
          selectedTargets: { planet: origin.id },
          selectedInputs: {},
        },
      })
      await processManualDeadlineTurn({
        clock,
        turnProcessor,
        turnsRepository,
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
      })
      playerView = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    }

    const sourceFleet = playerView.fleets[0]
    const moveOne = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
    const moveTwo = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_2")
    const moveThree = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_3")
    Assert.isDefined(sourceFleet)
    Assert.isDefined(moveOne)
    Assert.isDefined(moveTwo)
    Assert.isDefined(moveThree)
    expect(sourceFleet.strength).toBe(50)

    // Act
    // Both independent 30-strength submissions start together; the turn-row lock permits one.
    const thirtyStrengthGate = createStartGate(2)
    const thirtyStrengthResults = await Promise.allSettled([
      submitMoveAfterGate(thirtyStrengthGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveOne.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
      submitMoveAfterGate(thirtyStrengthGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveTwo.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
    ])

    // Assert
    expect(thirtyStrengthResults.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
    expect(thirtyStrengthResults.filter(({ status }) => status === "rejected")).toHaveLength(1)
    const afterThirtyRace = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const firstStrengthAction = afterThirtyRace.actions.find(({ id }) => id === moveOne.id)
    const secondStrengthAction = afterThirtyRace.actions.find(({ id }) => id === moveTwo.id)
    Assert.isDefined(firstStrengthAction)
    Assert.isDefined(secondStrengthAction)
    const thirtyStrengthSelections = [firstStrengthAction, secondStrengthAction].filter(({ selectedInputs }) => selectedInputs !== null)
    expect(thirtyStrengthSelections).toHaveLength(1)
    expect(thirtyStrengthSelections[0]?.selectedInputs).toStrictEqual({ strength: 30 })
    const expectedThirtyStrengthSelectionByStatus = {
      fulfilled: {
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 30 },
      },
      rejected: { selectedTargets: null, selectedInputs: null },
    }
    for (const [index, action] of [firstStrengthAction, secondStrengthAction].entries()) {
      const submission = thirtyStrengthResults[index]
      Assert.isDefined(submission)
      const expectedSelection = expectedThirtyStrengthSelectionByStatus[submission.status]
      expect(action.selectedTargets).toStrictEqual(expectedSelection.selectedTargets)
      expect(action.selectedInputs).toStrictEqual(expectedSelection.selectedInputs)
    }
    expect(afterThirtyRace.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 3 })
    expect(afterThirtyRace.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 1 })
    const sourceAfterThirtyRace = afterThirtyRace.fleets.find(({ id }) => id === sourceFleet.id)
    const reservedThirtyAction = thirtyStrengthSelections[0]
    Assert.isDefined(sourceAfterThirtyRace)
    Assert.isDefined(reservedThirtyAction)
    expect(sourceAfterThirtyRace.strength).toBe(50)
    expect(sourceAfterThirtyRace.strength - 30).toBe(20)

    const selectedThirtyAction = thirtyStrengthSelections[0]
    Assert.isDefined(selectedThirtyAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: strengthGameId,
      turn: playerView.turn,
      submittedActionTargets: { actionId: selectedThirtyAction.id, selectedTargets: null, selectedInputs: null },
    })

    // Cancel and replace the same instance concurrently; PostgreSQL may serialize either
    // mutation first, so the persisted selection and reservations must match one complete
    // serialized outcome rather than client response order.
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: strengthGameId,
      turn: playerView.turn,
      submittedActionTargets: {
        actionId: moveThree.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 20 },
      },
    })
    const cancelReplaceGate = createStartGate(2)
    const cancelReplaceResults = await Promise.allSettled([
      (async (): Promise<void> => {
        await cancelReplaceGate()
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: strengthGameId,
          turn: playerView.turn,
          submittedActionTargets: { actionId: moveThree.id, selectedTargets: null, selectedInputs: null },
        })
      })(),
      (async (): Promise<void> => {
        await cancelReplaceGate()
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: strengthGameId,
          turn: playerView.turn,
          submittedActionTargets: {
            actionId: moveThree.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength: 19 },
          },
        })
      })(),
    ])
    expect(cancelReplaceResults.every(({ status }) => status === "fulfilled")).toBe(true)
    const afterCancelReplace = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const moveThreeAfterRace = afterCancelReplace.actions.find(({ id }) => id === moveThree.id)
    Assert.isDefined(moveThreeAfterRace)
    const persistedCancelReplaceState = {
      selectedTargets: moveThreeAfterRace.selectedTargets,
      selectedInputs: moveThreeAfterRace.selectedInputs,
      influenceUncommitted: afterCancelReplace.resources[ResourceType.INFLUENCE].uncommitted,
      fuelUncommitted: afterCancelReplace.resources[ResourceType.FUEL].uncommitted,
    }
    expect([
      {
        selectedTargets: null,
        selectedInputs: null,
        influenceUncommitted: 6,
        fuelUncommitted: 2,
      },
      {
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 19 },
        influenceUncommitted: 3,
        fuelUncommitted: 1,
      },
    ]).toContainEqual(persistedCancelReplaceState)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: strengthGameId,
      turn: playerView.turn,
      submittedActionTargets: { actionId: moveThree.id, selectedTargets: null, selectedInputs: null },
    })

    // Both 20 and 30 fit the 50-strength source and the exact 6 Influence / 2 Fuel budget.
    const twentyThirtyGate = createStartGate(2)
    const twentyThirtyResults = await Promise.allSettled([
      submitMoveAfterGate(twentyThirtyGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveOne.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 20,
      }),
      submitMoveAfterGate(twentyThirtyGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveTwo.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
    ])
    expect(twentyThirtyResults.every(({ status }) => status === "fulfilled")).toBe(true)
    const beforeDeparture = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const moveOneBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === moveOne.id)
    const moveTwoBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === moveTwo.id)
    Assert.isDefined(moveOneBeforeDeparture)
    Assert.isDefined(moveTwoBeforeDeparture)
    expect(moveOneBeforeDeparture.selectedTargets).toStrictEqual({ fleet: sourceFleet.id, planet: destination.id })
    expect(moveOneBeforeDeparture.selectedInputs).toStrictEqual({ strength: 20 })
    expect(moveTwoBeforeDeparture.selectedTargets).toStrictEqual({ fleet: sourceFleet.id, planet: destination.id })
    expect(moveTwoBeforeDeparture.selectedInputs).toStrictEqual({ strength: 30 })
    expect(beforeDeparture.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 0 })
    expect(beforeDeparture.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })

    // Worker reloads both JSON fields from PostgreSQL; full force removes the original source row.
    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: player.client,
      gameId: strengthGameId,
      turn: beforeDeparture.turn,
    })
    const afterDeparture = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    expect(afterDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([20, 30])
    expect(afterDeparture.fleets.some(({ id }) => id === sourceFleet.id)).toBe(false)
    expect(afterDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
    const departedStrengths = afterDeparture.fleets.map(({ movement }) => {
      Assert.isDefined(movement)
      const strength = movement.submission.selectedInputs[branded<InputTag>("strength")]
      Assert.isDefined(strength)
      return strength
    })
    expect(departedStrengths.toSorted((first, second) => first - second)).toStrictEqual([20, 30])
    for (const [action, strength] of [
      [moveOne, 20],
      [moveTwo, 30],
    ] as const) {
      const journey = afterDeparture.fleets.find(({ movement }) => movement?.submission.id === action.id)
      Assert.isDefined(journey)
      expect(journey).toMatchObject({
        strength,
        originPlanetId: origin.id,
        destinationPlanetId: destination.id,
        distanceToEnd: expect.closeTo(1.04564350459425, 12),
        movement: {
          speed: 0.1,
          departureTurn: beforeDeparture.turn,
          pendingArrivalEffects: [],
          submission: {
            id: action.id,
            playerId: player.account.id,
            actionDefinitionId: MoveFleetStandard.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength },
          },
        },
      })
    }
    expect(afterDeparture.actions.find(({ id }) => id === moveOne.id)?.isInProgress).toBe(true)
    expect(afterDeparture.actions.find(({ id }) => id === moveTwo.id)?.isInProgress).toBe(true)

    // A separate resource-only race cannot spend the same Influence twice.
    const { createdGameId: resourceGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: ResourceRaceRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: resourceGameId })
    const resourceView = await player.client.gameplay.getPlayerView.query({ gameId: resourceGameId })
    const resourceOrigin = resourceView.galaxy.systems
      .flatMap(({ planets }) => planets)
      .find(({ ownerPlayerId }) => ownerPlayerId === resourceView.player.id)
    const firstBuild = resourceView.actions.find(({ id }) => id === "BUILD_FLEET_STANDARD_1")
    const secondBuild = resourceView.actions.find(({ id }) => id === "BUILD_FLEET_STANDARD_2")
    Assert.isDefined(resourceOrigin)
    Assert.isDefined(firstBuild)
    Assert.isDefined(secondBuild)
    const resourceGate = createStartGate(2)
    const resourceResults = await Promise.allSettled([
      submitBuildAfterGate(resourceGate, {
        client: player.client,
        gameId: resourceGameId,
        turn: resourceView.turn,
        actionId: firstBuild.id,
        planetId: resourceOrigin.id,
      }),
      submitBuildAfterGate(resourceGate, {
        client: player.client,
        gameId: resourceGameId,
        turn: resourceView.turn,
        actionId: secondBuild.id,
        planetId: resourceOrigin.id,
      }),
    ])
    expect(resourceResults.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
    expect(resourceResults.filter(({ status }) => status === "rejected")).toHaveLength(1)
    const afterResourceRace = await player.client.gameplay.getPlayerView.query({ gameId: resourceGameId })
    expect(afterResourceRace.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 3, uncommitted: 1 })
    const firstBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === firstBuild.id)
    const secondBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === secondBuild.id)
    Assert.isDefined(firstBuildAfterRace)
    Assert.isDefined(secondBuildAfterRace)
    const expectedBuildSelectionByStatus = {
      fulfilled: { selectedTargets: { planet: resourceOrigin.id }, selectedInputs: {} },
      rejected: { selectedTargets: null, selectedInputs: null },
    }
    for (const [index, action] of [firstBuildAfterRace, secondBuildAfterRace].entries()) {
      const submission = resourceResults[index]
      Assert.isDefined(submission)
      const expectedSelection = expectedBuildSelectionByStatus[submission.status]
      expect(action.selectedTargets).toStrictEqual(expectedSelection.selectedTargets)
      expect(action.selectedInputs).toStrictEqual(expectedSelection.selectedInputs)
    }
  })

  it("should serialize the composed Move and Attack reservation race on fresh PostgreSQL", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(ComposedReservationRaceRuleset))
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: ComposedReservationRaceRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    let playerView = await player.client.gameplay.getPlayerView.query({ gameId })
    const planets = playerView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerView.player.id)
    const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
    Assert.isDefined(origin)
    Assert.isDefined(destination)
    expect({ x: origin.x, y: origin.y }).toStrictEqual({ x: 58.43842436611536, y: 49.61917707239218 })
    expect({ x: destination.x, y: destination.y }).toStrictEqual({ x: 57.77998524757335, y: 50.556704120958045 })

    // Act: create source strength50 with five real saved turns and preserve exactly8I/2F.
    for (let buildCount = 0; buildCount < 5; buildCount += 1) {
      const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: playerView.turn,
        submittedActionTargets: {
          actionId: buildAction.id,
          selectedTargets: { planet: origin.id },
          selectedInputs: {},
        },
      })
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: playerView.turn })
      playerView = await player.client.gameplay.getPlayerView.query({ gameId })
    }

    const sourceFleet = playerView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
    const moveAction = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
    const attackAction = playerView.actions.find(({ id }) => id === AttackMoveTest.id + "_1")
    Assert.isDefined(sourceFleet)
    Assert.isDefined(moveAction)
    Assert.isDefined(attackAction)
    expect(sourceFleet.strength).toBe(50)
    expect(playerView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 8 })
    expect(playerView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 2 })

    const startTogether = createStartGate(2)
    const reservationRace = await Promise.allSettled([
      submitMoveAfterGate(startTogether, {
        client: player.client,
        gameId,
        turn: playerView.turn,
        actionId: moveAction.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 20,
      }),
      submitMoveAfterGate(startTogether, {
        client: player.client,
        gameId,
        turn: playerView.turn,
        actionId: attackAction.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
    ])
    expect(reservationRace.map(({ status }) => status)).toStrictEqual(["fulfilled", "fulfilled"])

    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 20 },
    })
    expect(selectedView.actions.find(({ id }) => id === attackAction.id)).toMatchObject({
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 30 },
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 0 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })
    expect(selectedView.fleets.find(({ id }) => id === sourceFleet.id)?.strength).toBe(50)

    // Assert: PostgreSQL-backed actual worker charges both costs once and persists both exact departures.
    await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: selectedView.turn })
    const afterWorkerDeparture = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterWorkerDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([20, 30])
    expect(afterWorkerDeparture.fleets.some(({ id }) => id === sourceFleet.id)).toBe(false)
    expect(afterWorkerDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
    expect(afterWorkerDeparture.resources[ResourceType.INFLUENCE].total).toBe(0)
    expect(afterWorkerDeparture.resources[ResourceType.FUEL].total).toBe(0)
  })

  it("should serialize cancellation against Ready with the production PostgreSQL worker", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        turnIntervalSeconds: Time.in(TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
    const action = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
    Assert.isDefined(action)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: initialView.turn,
      submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
    })

    // Act
    // Cancellation and Ready contend on the real turn row; the final influence total identifies the locked set.
    const gate = createStartGate(2)
    const [cancellation, readiness] = await Promise.allSettled([
      (async (): Promise<void> => {
        await gate()
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: initialView.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
        })
      })(),
      (async (): Promise<unknown> => {
        await gate()
        return await player.client.gameplay.updateReadiness.mutate({ gameId, turn: initialView.turn, isReady: true })
      })(),
    ])
    expect(readiness.status).toBe("fulfilled")
    const expectedCancellationResultByStatus = {
      fulfilled: { status: "fulfilled" },
      rejected: { status: "rejected", reason: { data: { code: "BAD_REQUEST" } } },
    }
    expect(cancellation).toMatchObject(expectedCancellationResultByStatus[cancellation.status])
    const expectedByStatus = {
      fulfilled: { selectedTargets: null, selectedInputs: null, influenceTotal: 3 },
      rejected: { selectedTargets: {}, selectedInputs: {}, influenceTotal: 8 },
    }
    const expected = expectedByStatus[cancellation.status]

    // Assert
    const afterReady = await player.client.gameplay.getPlayerView.query({ gameId })
    const expectedReadinessObservationByTurn = {
      [initialView.turn]: {
        statuses: ["AWAITING_PROCESSING", "PROCESSING"],
        isReady: true,
        selectedTargets: expected.selectedTargets,
        selectedInputs: expected.selectedInputs,
      },
      [initialView.turn + 1]: {
        statuses: ["COLLECTING_ACTIONS"],
        isReady: false,
        selectedTargets: null,
        selectedInputs: null,
      },
    }
    const expectedReadinessObservation = expectedReadinessObservationByTurn[afterReady.turn]
    Assert.isDefined(expectedReadinessObservation)
    expect(expectedReadinessObservation.statuses).toContain(afterReady.turnStatus)
    expect(afterReady.player.isReady).toBe(expectedReadinessObservation.isReady)
    const observedAction = afterReady.actions.find(({ id }) => id === action.id)
    Assert.isDefined(observedAction)
    expect(observedAction.selectedTargets).toStrictEqual(expectedReadinessObservation.selectedTargets)
    expect(observedAction.selectedInputs).toStrictEqual(expectedReadinessObservation.selectedInputs)

    const successorView = await waitForCollectingSuccessor({ client: player.client, gameId, closedTurn: initialView.turn })
    expect(successorView.resources[ResourceType.INFLUENCE].total).toBe(expected.influenceTotal)
    expect(normalizeApiDate(successorView.turnEndsAt).getTime()).toBeGreaterThan(Date.now() + 5_000)

    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const afterRejectedEdits = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterRejectedEdits).toStrictEqual(successorView)
  })

  it("should serialize deadline submission against the actual PostgreSQL due-turn transition", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        turnIntervalSeconds: Time.in(TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
    const action = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
    Assert.isDefined(action)
    const turnsRepository = new TurnsRepository({ db: server.database, logger: Logger.get() })

    // Act
    // Submission and the real due-turn transition contend on this game's turn row at its scheduled deadline.
    const gate = createStartGate(2)
    const [submission, closure] = await Promise.allSettled([
      (async (): Promise<unknown> => {
        await gate()
        return await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: initialView.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
        })
      })(),
      (async (): Promise<void> => {
        await gate()
        await turnsRepository.markDueTurnsAwaitingProcessing({ since: normalizeApiDate(initialView.turnEndsAt) })
      })(),
    ])
    expect(closure.status).toBe("fulfilled")
    const expectedSubmissionResultByStatus = {
      fulfilled: { status: "fulfilled" },
      rejected: { status: "rejected", reason: { data: { code: "BAD_REQUEST" } } },
    }
    expect(submission).toMatchObject(expectedSubmissionResultByStatus[submission.status])
    const expectedByStatus = {
      fulfilled: { selectedTargets: {}, selectedInputs: {}, influenceTotal: 8 },
      rejected: { selectedTargets: null, selectedInputs: null, influenceTotal: 3 },
    }
    const expected = expectedByStatus[submission.status]

    // Assert
    const afterClosure = await player.client.gameplay.getPlayerView.query({ gameId })
    const expectedClosureObservationByTurn = {
      [initialView.turn]: {
        statuses: ["AWAITING_PROCESSING", "PROCESSING"],
        selectedTargets: expected.selectedTargets,
        selectedInputs: expected.selectedInputs,
      },
      [initialView.turn + 1]: {
        statuses: ["COLLECTING_ACTIONS"],
        selectedTargets: null,
        selectedInputs: null,
      },
    }
    const expectedClosureObservation = expectedClosureObservationByTurn[afterClosure.turn]
    Assert.isDefined(expectedClosureObservation)
    expect(expectedClosureObservation.statuses).toContain(afterClosure.turnStatus)
    const observedAction = afterClosure.actions.find(({ id }) => id === action.id)
    Assert.isDefined(observedAction)
    expect(observedAction.selectedTargets).toStrictEqual(expectedClosureObservation.selectedTargets)
    expect(observedAction.selectedInputs).toStrictEqual(expectedClosureObservation.selectedInputs)

    const successorView = await waitForCollectingSuccessor({ client: player.client, gameId, closedTurn: initialView.turn })
    expect(successorView.resources[ResourceType.INFLUENCE].total).toBe(expected.influenceTotal)
    expect(normalizeApiDate(successorView.turnEndsAt).getTime()).toBeGreaterThan(Date.now() + 5_000)

    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const afterRejectedEdits = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterRejectedEdits).toStrictEqual(successorView)
  })
})

const StrengthRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: RULESET_ID_FOR_STRENGTH_RACES,
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
    { id: "MOVE_FLEET_STANDARD_3", actionDefinitionId: MoveFleetStandard.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 16,
    [ResourceType.METAL]: 5,
    [ResourceType.FUEL]: 2,
  },
})

const ComposedReservationRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_composed_reservation_race",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 18,
    [ResourceType.METAL]: 10,
    [ResourceType.FUEL]: 2,
  },
})

const ResourceRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: RULESET_ID_FOR_RESOURCE_RACE,
  actionPool: [...TestRuleset.actionPool, { id: "BUILD_FLEET_STANDARD_2", actionDefinitionId: BuildFleetStandard.id }],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
  },
})

async function markManualDeadlineDue({
  clock,
  turnsRepository,
}: {
  clock: ControlledClock
  turnsRepository: TurnsRepository
}): Promise<void> {
  clock.increment({ time: MANUAL_WORKER_CLOCK_ADVANCE })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
}

async function processManualDeadlineTurn({
  clock,
  turnProcessor,
  turnsRepository,
  client,
  gameId,
  turn,
}: {
  clock: ControlledClock
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  client: AuthenticatedApiClient["client"]
  gameId: GameId
  turn: number
}): Promise<void> {
  await markManualDeadlineDue({ clock, turnsRepository })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const nextView = await client.gameplay.getPlayerView.query({ gameId })
  expect(nextView.turn).toBe(turn + 1)
  expect(nextView.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
}

function normalizeApiDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

async function waitForCollectingSuccessor({
  client,
  gameId,
  closedTurn,
}: {
  client: AuthenticatedApiClient["client"]
  gameId: number
  closedTurn: number
}): Promise<Awaited<ReturnType<AuthenticatedApiClient["client"]["gameplay"]["getPlayerView"]["query"]>>> {
  await expect
    .poll(
      async () => {
        const view = await client.gameplay.getPlayerView.query({ gameId })
        return { turn: view.turn, turnStatus: view.turnStatus }
      },
      { interval: 100, timeout: 12_000 },
    )
    .toStrictEqual({ turn: closedTurn + 1, turnStatus: "COLLECTING_ACTIONS" })

  return await client.gameplay.getPlayerView.query({ gameId })
}

function createStartGate(parties: number): () => Promise<void> {
  const gate = Promise.withResolvers<undefined>()
  let arrivals = 0
  return async () => {
    arrivals += 1
    if (arrivals === parties) {
      gate.resolve(undefined)
    }
    await gate.promise
  }
}

async function submitMoveAfterGate(
  waitAtStart: () => Promise<void>,
  {
    client,
    gameId,
    turn,
    actionId,
    fleetId,
    destinationId,
    strength,
  }: {
    client: AuthenticatedApiClient["client"]
    gameId: number
    turn: number
    actionId: string
    fleetId: string
    destinationId: string
    strength: number
  },
): Promise<void> {
  await waitAtStart()
  await client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn,
    submittedActionTargets: {
      actionId,
      selectedTargets: { fleet: fleetId, planet: destinationId },
      selectedInputs: { strength },
    },
  })
}

async function submitBuildAfterGate(
  waitAtStart: () => Promise<void>,
  {
    client,
    gameId,
    turn,
    actionId,
    planetId,
  }: {
    client: AuthenticatedApiClient["client"]
    gameId: number
    turn: number
    actionId: string
    planetId: string
  },
): Promise<void> {
  await waitAtStart()
  await client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn,
    submittedActionTargets: { actionId, selectedTargets: { planet: planetId }, selectedInputs: {} },
  })
}
