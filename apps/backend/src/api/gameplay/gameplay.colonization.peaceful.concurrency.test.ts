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

    const createViewsSetupPhase1Result = await createViewsSetup({
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
    const { aliceBuildId, bobBuildId, aliceSource, bobMoveId } = createViewsSetupPhase1Result
    let { views, stage } = createViewsSetupPhase1Result
    views = stage.views
    // Assert Bob captured journey follows the pinned route while the target stays unclaimed.
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobMoveId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

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
    const persistedEnemy = getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)
    expect(persistedEnemy.id).toBe(bobJourney.id)
    const bobReplayArrivalTick = stage.resolved.fleets[bobJourney.id]?.arrivedAtTick
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35).id).toBe(aliceSource.id)

    // Act: submit Alice ordinary Move35.
    const aliceMoveId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    expect(MoveFleetSpeed10.effects.map(({ type }) => type)).toStrictEqual(["FLEET_MOVE"])
    // Act: resolve Alice captured Move input through the real processor.
    const ordinaryArrival = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = ordinaryArrival.views
    // Assert copied-input replay separately from the persisted player-view read-through.
    const replayMoveFleet = findPublicFleet(Object.values(ordinaryArrival.resolved.fleets), {
      ownerPlayerId: playerIdFor(alice),
      originPlanetId: target.id,
      strength: 35,
    })
    Assert.isDefined(replayMoveFleet)

    verifyPublicState({
      replayMoveFleet,
      views,
      target,
      bobJourney,
      aliceMoveId,
      ordinaryArrival,
      gameId,
      alice,
      homeA,
      bob,
      homeB,
      bobBuildId,
      bobMoveId,
      aliceBuildId,
      bobReplayArrivalTick,
      persistedEnemy,
    })
  })

  it("should colonize an unclaimed Planet with an enemy Fleet present and no Assault", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture

    const createViewsSetupPhase2Result = await createViewsSetup2({
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
    const { slowColonizeId, enemyMoveId } = createViewsSetupPhase2Result
    let { views } = createViewsSetupPhase2Result
    expect(Math.hypot(homeB.x - target.x, homeB.y - target.y)).toBeCloseTo(18.852953053708077, 12)

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
    })
    views = updatedVerifyAliceJourney.views
    const stillMovingColonizer = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    Assert.isDefined(stillMovingColonizer)

    const updatedVerifyStillMovingColonizer = await verifyStillMovingColonizer({
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

    verifyColonizeContinuation({ colonizeContinuation, target, homeA, homeB, views, claimed })
  })
})

async function createViewsSetup({
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
}: CreateViewsSetupInput): Promise<CreateViewsSetupResult> {
  let views = fixture.views

  const aliceBuildId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  const bobBuildId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet10ForStaging.id,
    selectedTargets: { planet: homeB.id },
    selectedInputs: {},
  })
  // Act: process the public Build submissions.
  let stage = await processTurnWithReplay({
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = stage.views
  // Assert both public Builds created the expected forces.
  const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
  const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 10)
  expect(required(views[0]).actions.find(({ id }) => id === aliceBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  expect(required(views[1]).actions.find(({ id }) => id === bobBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })

  // Act: submit Bob ordinary Move.
  const bobMoveId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: bobSource.id, planet: target.id },
    selectedInputs: { strength: 10 },
  })
  // Act: process Bob Move departure Turn.
  stage = await processTurnWithReplay({
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  return { views, aliceBuildId, bobBuildId, stage, aliceSource, bobMoveId }
}

async function createViewsSetup2({
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
}: CreateViewsSetup2Input): Promise<CreateViewsSetup2Result> {
  let views = fixture.views
  const aliceBuildId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  const bobBuildId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: homeB.id },
    selectedInputs: {},
  })
  const built = await processTurnWithReplay({
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = built.views
  const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
  const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 35)
  expect(required(views[0]).actions.find(({ id }) => id === aliceBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  expect(required(views[1]).actions.find(({ id }) => id === bobBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })

  const slowColonizeId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: ColonizeFleetSpeed01.id,
    selectedTargets: { fleet: aliceSource.id, planet: target.id },
    selectedInputs: { strength: 35 },
  })
  const enemyMoveId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: bobSource.id, planet: target.id },
    selectedInputs: { strength: 10 },
  })
  expect(Math.hypot(homeA.x - target.x, homeA.y - target.y)).toBeCloseTo(1.2645395167985714, 12)
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

function verifyPublicState({
  replayMoveFleet,
  views,
  target,
  bobJourney,
  aliceMoveId,
  ordinaryArrival,
  gameId,
  alice,
  homeA,
  bob,
  homeB,
  bobBuildId,
  bobMoveId,
  aliceBuildId,
  bobReplayArrivalTick,
  persistedEnemy,
}: VerifyPublicStateInput): void {
  assertReplayMoveFleet({
    replayMoveFleet,
    views,
    target,
    bobJourney,
    aliceMoveId,
    ordinaryArrival,
    gameId,
    alice,
    homeA,
    bob,
    homeB,
    bobBuildId,
    bobMoveId,
    aliceBuildId,
    bobReplayArrivalTick,
    persistedEnemy,
  })
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

function verifyColonizeContinuation({ colonizeContinuation, target, homeA, homeB, views, claimed }: VerifyColonizeContinuationInput): void {
  expect(colonizeContinuation.actionOutcomes).toContainEqual(
    expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining(' colonized Planet "planet 649967" with 20 Strength') }),
  )
  logReceipt("[C3-11 public enemy-presence receipt]", {
    seed: 1,
    target: { id: target.id, name: target.name, coordinates: target.coordinates },
    arrivalDistance: {
      alice: Math.hypot(homeA.x - target.x, homeA.y - target.y),
      bob: Math.hypot(homeB.x - target.x, homeB.y - target.y),
    },
    enemyArrivalBeforeClaim: { owner: required(views[1]).player.id, strength: 10 },
    finalOwner: claimed.ownerPlayerId,
    colonizerSurvivor: 15,
    enemySurvivor: 10,
    colonizerInfluence: required(views[0]).resources[ResourceType.INFLUENCE].total,
    enemyInfluence: required(views[1]).resources[ResourceType.INFLUENCE].total,
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
