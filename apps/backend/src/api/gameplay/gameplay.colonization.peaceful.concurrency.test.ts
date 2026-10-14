import { Assert } from "@guillaume-docquier/tools-ts"
import type { NonNegativeNumber } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { describe, expect, it } from "vitest"
import type { PlayerView, Fleet, Planet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { processTurnWithReplay as CapturedprocessTurnWithReplay } from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { createPublicTwoPlayerFixture as CapturedcreatePublicTwoPlayerFixture } from "#tests/colonization/gameplay.colonization.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { getPlanets, getFleetAt, processTurnWithReplay } from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  BuildFleet10ForStaging,
  BuildFleet35,
  MoveFleetSpeed10,
  ColonizeFleetSpeed01,
  logReceipt,
  required,
  playerIdFor,
  findPublicFleet,
  submitAction,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import { assertReplayMoveFleet } from "../../tests/fleet-assertions/gameplay.colonization.combat-prevention.ts"

describe("public Colonization worker companions", () => {
  it("should persist an ordinary public Move35 beside enemy10 without combat or claiming", async () => {
    // Arrange the seeded public game and Build submissions.
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture

    const viewsScenario12 = await prepareViewsScenario({
      fixture,
      alice,
      gameId,
      homeA,
      bob,
      homeB,
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      target,
    })
    const { viewsSetup1 } = viewsScenario12
    let { views, stage } = viewsScenario12

    // Act: process Bob arrival Turn.
    stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    // Assert Bob arrived at strength10 while the target remains unclaimed.

    const persistedEnemySetup2 = await createPersistedEnemySetup({
      ...viewsScenario12,
      views,
      target,
      stage,
      homeA,
      alice,
      gameId,
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
    })
    const { ordinaryArrival } = persistedEnemySetup2
    views = ordinaryArrival.views
    // Assert copied-input replay separately from the persisted player-view read-through.
    const replayMoveFleet = findPublicFleet(Object.values(ordinaryArrival.resolved.fleets), {
      ownerPlayerId: playerIdFor(alice),
      originPlanetId: target.id,
      strength: 35,
    })
    Assert.isDefined(replayMoveFleet)

    verifyPublicState({
      ...viewsScenario12,
      ...persistedEnemySetup2,
      ...viewsSetup1,
      replayMoveFleet,
      views,
      target,
      gameId,
      alice,
      homeA,
      bob,
      homeB,
    })
  })

  it("should colonize an unclaimed Planet with an enemy Fleet present and no Assault", async () => {
    await using server = await ConcurrencyTestApiServer.create()

    const clientsSetup3 = await createClientsSetup({ server })
    const { clients, gameId, clock, turnProcessor, turnsRepository, homeB, target, viewsSetup2, slowColonizeId, enemyMoveId } =
      clientsSetup3
    let { views } = clientsSetup3

    const departed = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = departed.views
    const aliceJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === enemyMoveId)
    Assert.isDefined(aliceJourney)
    Assert.isDefined(bobJourney)

    const updatedVerifyAliceJourney = await verifyAliceJourney({
      ...clientsSetup3,
      aliceJourney,
      bobJourney,
      views,
      server,
    })
    views = updatedVerifyAliceJourney.views
    const stillMovingColonizer = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    Assert.isDefined(stillMovingColonizer)

    const updatedVerifyStillMovingColonizer = await verifyStillMovingColonizer({
      ...clientsSetup3,
      ...viewsSetup2,
      stillMovingColonizer,
      views,
      server,
    })
    views = updatedVerifyStillMovingColonizer.views
    const beforeFinalArrival = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    Assert.isDefined(beforeFinalArrival)
    expect(beforeFinalArrival.distanceToEnd).toBeCloseTo(0.0645395167985714, 12)

    const finalArrival = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = finalArrival.views
    const claimed = getPlanets(required(views[0])).find(({ id }) => id === target.id)
    Assert.isDefined(claimed)
    expect(claimed.ownerPlayerId).toBe(required(views[0]).player.id)
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 15)).toBeDefined()
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)).toBeDefined()
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 25)).toBeDefined()
    expect(required(views[0]).actions.find(({ id }) => id === slowColonizeId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[1]).actions.find(({ id }) => id === enemyMoveId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[0]).resources[ResourceType.INFLUENCE].total).toBe(473)
    expect(required(views[1]).resources[ResourceType.INFLUENCE].total).toBe(495)
    expect(required(views[0]).resources[ResourceType.COLONY].total).toBe(0)
    expect(required(views[1]).resources[ResourceType.COLONY].total).toBe(0)
    const colonizeContinuation = finalArrival.resolved.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === slowColonizeId,
    )
    Assert.isDefined(colonizeContinuation)

    verifyColonizeContinuation({ ...clientsSetup3, colonizeContinuation, views, claimed })
  })
})

async function createViewsSetup(input: CreateViewsSetupInput): Promise<CreateViewsSetupResult> {
  let views = input.fixture.views

  const aliceBuildId = await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: input.homeA.id },
    selectedInputs: {},
  })
  const bobBuildId = await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet10ForStaging.id,
    selectedTargets: { planet: input.homeB.id },
    selectedInputs: {},
  })
  // Act: process the public Build submissions.
  let stage = await processTurnWithReplay({ ...input, turn: required(views[0]).turn })
  views = stage.views
  // Assert both public Builds created the expected forces.
  const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, input.homeA.id, 35)
  const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, input.homeB.id, 10)
  expect(required(views[0]).actions.find(({ id }) => id === aliceBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  expect(required(views[1]).actions.find(({ id }) => id === bobBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })

  // Act: submit Bob ordinary Move.
  const bobMoveId = await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: bobSource.id, planet: input.target.id },
    selectedInputs: { strength: 10 },
  })
  // Act: process Bob Move departure Turn.
  stage = await processTurnWithReplay({ ...input, turn: required(views[0]).turn })
  return { views, aliceBuildId, bobBuildId, stage, aliceSource, bobMoveId }
}

async function createViewsSetup2(input: CreateViewsSetup2Input): Promise<CreateViewsSetup2Result> {
  let views = input.fixture.views
  const aliceBuildId = await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: input.homeA.id },
    selectedInputs: {},
  })
  const bobBuildId = await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: input.homeB.id },
    selectedInputs: {},
  })
  const built = await processTurnWithReplay({ ...input, turn: required(views[0]).turn })
  views = built.views
  const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, input.homeA.id, 35)
  const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, input.homeB.id, 35)
  expect(required(views[0]).actions.find(({ id }) => id === aliceBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  expect(required(views[1]).actions.find(({ id }) => id === bobBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })

  const slowColonizeId = await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(views[0]),
    actionDefinitionId: ColonizeFleetSpeed01.id,
    selectedTargets: { fleet: aliceSource.id, planet: input.target.id },
    selectedInputs: { strength: 35 },
  })
  const enemyMoveId = await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: bobSource.id, planet: input.target.id },
    selectedInputs: { strength: 10 },
  })
  expect(Math.hypot(input.homeA.x - input.target.x, input.homeA.y - input.target.y)).toBeCloseTo(1.2645395167985714, 12)
  return { views, slowColonizeId, enemyMoveId }
}

type CreateViewsSetupInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicTwoPlayerFixture>>
  alice: AuthenticatedApiClient
  gameId: number
  homeA: Planet
  bob: AuthenticatedApiClient
  homeB: Planet
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  target: Planet
}

type CreateViewsSetupResult = {
  views: PlayerView[]
  aliceBuildId: string
  bobBuildId: string
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  aliceSource: Fleet
  bobMoveId: string
}

type CreateViewsSetup2Input = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicTwoPlayerFixture>>
  alice: AuthenticatedApiClient
  gameId: number
  homeA: Planet
  bob: AuthenticatedApiClient
  homeB: Planet
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  target: Planet
}

type CreateViewsSetup2Result = { views: PlayerView[]; slowColonizeId: string; enemyMoveId: string }

function verifyPublicState(input: VerifyPublicStateInput): void {
  assertReplayMoveFleet({ ...input, bobReplayArrivalTick: input.bobReplayArrivalTick })
}

async function verifyAliceJourney({
  aliceJourney,
  bobJourney,
  views,
  target,
  server,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
  gameId,
}: VerifyAliceJourneyInput): Promise<VerifyAliceJourneyResult> {
  expect(aliceJourney.strength).toBe(35)
  expect(aliceJourney.distanceToEnd).toBeCloseTo(Number("1.1645395167985714"), 12)
  expect(bobJourney.strength).toBe(10)
  expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

  const enemyArrival = await processTurnWithReplay({
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = enemyArrival.views
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)).toMatchObject({
    ownerPlayerId: required(views[1]).player.id,
    strength: 10,
  })

  return { views }
}

async function verifyStillMovingColonizer({
  stillMovingColonizer,
  views,
  slowColonizeId,
  server,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
  gameId,
  target,
}: VerifyStillMovingColonizerInput): Promise<VerifyStillMovingColonizerResult> {
  expect(stillMovingColonizer.distanceToEnd).toBeCloseTo(1.0645395167985714, 12)
  expect(required(views[0]).actions.find(({ id }) => id === slowColonizeId)?.isInProgress).toBe(true)

  for (let turn = 0; turn < 10; turn += 1) {
    const continued = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = continued.views
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10).strength).toBe(10)
    expect(required(views[0]).actions.find(({ id }) => id === slowColonizeId)?.isInProgress).toBe(true)
  }

  return { views }
}

function verifyColonizeContinuation(input: VerifyColonizeContinuationInput): void {
  expect(input.colonizeContinuation.actionOutcomes).toContainEqual(
    expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining(' colonized Planet "planet 649967" with 20 Strength') }),
  )
  logReceipt("[C3-11 public enemy-presence receipt]", {
    seed: 1,
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates },
    arrivalDistance: {
      alice: Math.hypot(input.homeA.x - input.target.x, input.homeA.y - input.target.y),
      bob: Math.hypot(input.homeB.x - input.target.x, input.homeB.y - input.target.y),
    },
    enemyArrivalBeforeClaim: { owner: required(input.views[1]).player.id, strength: 10 },
    finalOwner: input.claimed.ownerPlayerId,
    colonizerSurvivor: 15,
    enemySurvivor: 10,
    colonizerInfluence: required(input.views[0]).resources[ResourceType.INFLUENCE].total,
    enemyInfluence: required(input.views[1]).resources[ResourceType.INFLUENCE].total,
  })
}

type VerifyPublicStateInput = {
  replayMoveFleet: ResolutionFleet
  views: PlayerView[]
  target: Planet
  bobJourney: Fleet
  aliceMoveId: string
  ordinaryArrival: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  gameId: number
  alice: AuthenticatedApiClient
  homeA: Planet
  bob: AuthenticatedApiClient
  homeB: Planet
  bobBuildId: string
  bobMoveId: string
  aliceBuildId: string
  bobReplayArrivalTick: undefined | NonNegativeNumber
  persistedEnemy: Fleet
}

type VerifyAliceJourneyInput = {
  aliceJourney: Fleet
  bobJourney: Fleet
  views: PlayerView[]
  target: Planet
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
}

type VerifyAliceJourneyResult = { views: PlayerView[] }

type VerifyStillMovingColonizerInput = {
  stillMovingColonizer: Fleet
  views: PlayerView[]
  slowColonizeId: string
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  target: Planet
}

type VerifyStillMovingColonizerResult = { views: PlayerView[] }

type VerifyColonizeContinuationInput = {
  colonizeContinuation: ResolvedTurnState["resolvedContinuations"][number]
  target: Planet
  homeA: Planet
  homeB: Planet
  views: PlayerView[]
  claimed: Planet
}

async function prepareViewsScenario(input: PrepareViewsScenarioInput): Promise<PrepareViewsScenarioResult> {
  const viewsSetup1 = await createViewsSetup({ ...input })
  const { aliceSource, bobMoveId } = viewsSetup1
  let { views, stage } = viewsSetup1
  views = stage.views
  // Assert Bob captured journey follows the pinned route while the target stays unclaimed.
  const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobMoveId)
  Assert.isDefined(bobJourney)
  expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
  expect(getPlanets(required(views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()
  return { viewsSetup1, aliceSource, views, stage, bobJourney }
}

async function createPersistedEnemySetup(input: CreatePersistedEnemySetupInput): Promise<CreatePersistedEnemySetupResult> {
  const persistedEnemy = getFleetAt(required(input.views[1]), required(input.views[1]).player.id, input.target.id, 10)
  expect(persistedEnemy.id).toBe(input.bobJourney.id)
  const bobReplayArrivalTick = input.stage.resolved.fleets[input.bobJourney.id]?.arrivedAtTick
  expect(getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()
  expect(getFleetAt(required(input.views[0]), required(input.views[0]).player.id, input.homeA.id, 35).id).toBe(input.aliceSource.id)

  // Act: submit Alice ordinary Move35.
  const aliceMoveId = await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(input.views[0]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: input.aliceSource.id, planet: input.target.id },
    selectedInputs: { strength: 35 },
  })
  expect(MoveFleetSpeed10.effects.map(({ type }) => type)).toStrictEqual(["FLEET_MOVE"])
  // Act: resolve Alice captured Move input through the real processor.
  const ordinaryArrival = await processTurnWithReplay({ ...input, turn: required(input.views[0]).turn })
  return { persistedEnemy, bobReplayArrivalTick, aliceMoveId, ordinaryArrival }
}

async function createClientsSetup(input: CreateClientsSetupInput): Promise<CreateClientsSetupResult> {
  const fixture = await createPublicTwoPlayerFixture(input.server)
  const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture

  const viewsSetup2 = await createViewsSetup2({
    fixture,
    alice,
    gameId,
    homeA,
    bob,
    homeB,
    server: input.server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    target,
  })
  const { slowColonizeId, enemyMoveId } = viewsSetup2
  const { views } = viewsSetup2
  expect(Math.hypot(homeB.x - target.x, homeB.y - target.y)).toBeCloseTo(18.852953053708077, 12)
  return {
    clients,
    gameId,
    clock,
    turnProcessor,
    turnsRepository,
    homeA,
    homeB,
    target,
    viewsSetup2,
    slowColonizeId,
    enemyMoveId,
    views,
  }
}

type PrepareViewsScenarioInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicTwoPlayerFixture>>
  alice: AuthenticatedApiClient
  gameId: number
  homeA: Planet
  bob: AuthenticatedApiClient
  homeB: Planet
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  target: Planet
}

type PrepareViewsScenarioResult = {
  viewsSetup1: CreateViewsSetupResult
  aliceSource: Fleet
  views: PlayerView[]
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  bobJourney: Fleet
}

type CreatePersistedEnemySetupInput = {
  views: PlayerView[]
  target: Planet
  bobJourney: Fleet
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  homeA: Planet
  aliceSource: Fleet
  alice: AuthenticatedApiClient
  gameId: number
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
}

type CreatePersistedEnemySetupResult = {
  persistedEnemy: Fleet
  bobReplayArrivalTick: undefined | NonNegativeNumber
  aliceMoveId: string
  ordinaryArrival: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
}

type CreateClientsSetupInput = { server: ConcurrencyTestApiServer }

type CreateClientsSetupResult = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  homeA: Planet
  homeB: Planet
  target: Planet
  viewsSetup2: CreateViewsSetup2Result
  slowColonizeId: string
  enemyMoveId: string
  views: PlayerView[]
}
