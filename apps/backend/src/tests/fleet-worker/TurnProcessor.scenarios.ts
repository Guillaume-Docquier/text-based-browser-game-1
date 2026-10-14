import {
  Assert,
  branded,
  indexBy,
  Logger,
  mulberry32Prng,
  type DeepUnbranded,
  Result,
  Rng,
  type RngState,
  Time,
  UnitOfTime,
} from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { expect } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { Planet, Fleet, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ApiServer } from "#tests/ApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { type ProcessedTurnModel, type TurnToProcessModel, TurnsRepository } from "#turn-processing/turns.repository.ts"
import { AssaultWorkerRuleset, type ThreeOwnerStationedAssaultFixture } from "./TurnProcessor.ts"

export async function createThreeOwnerStationedAssaultFixture(
  input: CreateThreeOwnerStationedAssaultFixtureInput,
): Promise<ThreeOwnerStationedAssaultFixture> {
  const aliceSetup1 = await createAliceSetup({ ...input })
  const { alice, clients, playerIds, gameId, turnProcessor, turnsRepository, target, homeA, homeB, homeC } = aliceSetup1
  Assert.isDefined(homeA)
  Assert.isDefined(homeB)
  Assert.isDefined(homeC)
  const homes = [homeA, homeB, homeC] as const
  const routeDistances = homes.map((home) => Math.hypot(home.x - target.x, home.y - target.y))
  expect({
    target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
    homes: homes.map((home, index) => ({
      playerId: playerIds[index],
      id: home.id,
      name: home.name,
      coordinates: home.coordinates,
      x: home.x,
      y: home.y,
      distance: routeDistances[index],
    })),
  }).toStrictEqual(expectedThreeOwnerHomes)

  // Arrange: build literal A30/B20/C10 through public Build submissions and completed actual-worker turns.

  await verifyBuildRound({ ...aliceSetup1, homes })

  // Assert: public worker builds have independently established force inputs before staging.
  const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const builtFleets = homes.map((home, index) => {
    const playerId = playerIds[index]
    Assert.isDefined(playerId)
    return findFleetAtLocation(builtView, playerId, home.id, false)
  })
  const builtFleetA = builtFleets[0]
  const builtFleetB = builtFleets[1]
  const builtFleetC = builtFleets[2]
  Assert.isDefined(builtFleetA)
  Assert.isDefined(builtFleetB)
  Assert.isDefined(builtFleetC)

  await verifyActionSelections({ ...aliceSetup1, builtFleetA, builtFleetB, builtFleetC, builtFleets })
  const firstTransitView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const firstTransit = homes.map((home, index) => {
    const playerId = playerIds[index]
    Assert.isDefined(playerId)
    return findFleetAtLocation(firstTransitView, playerId, home.id, true)
  })

  const secondTransitViewSetup2 = await createSecondTransitViewSetup({
    ...aliceSetup1,
    firstTransit,
    firstTransitView,
  })
  const { secondTransitView } = secondTransitViewSetup2
  await processPublicTurn({ clients, gameId, turn: secondTransitView.turn, turnProcessor })
  const stationedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const stationed = homes.map((home, index) => {
    const playerId = playerIds[index]
    Assert.isDefined(playerId)
    return findFleetAtLocation(stationedView, playerId, target.id, false)
  })
  const stationedA = stationed[0]
  const stationedB = stationed[1]
  const stationedC = stationed[2]
  Assert.isDefined(stationedA)
  Assert.isDefined(stationedB)
  Assert.isDefined(stationedC)
  expect([stationedA.strength, stationedB.strength, stationedC.strength]).toStrictEqual([30, 20, 10])
  return {
    clients,
    playerIds,
    gameId,
    turnProcessor,
    turnsRepository,
    target,
    homes,
    stationed: [stationedA, stationedB, stationedC] as const,
  }
}

export async function processPublicTurn({ clients, gameId, turn, turnProcessor, process = true }: ProcessPublicTurnInput): Promise<void> {
  await Promise.all(clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })))
  if (process) {
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  }
}

export async function observeTurnAndRollback(input: ObserveTurnAndRollbackInput): Promise<TurnToProcessModel> {
  // Arrange: the public readiness route has closed the requested turn before acquiring the production repository lock.
  let observed: TurnToProcessModel | undefined
  const message = `Intentional I2-06 observation rollback for game ${input.gameId} turn ${input.turn}`

  // Act: copy the production-parsed input, then force the same transaction to undo PROCESSING and lock changes.
  await expect(
    input.db.transaction(async (tx) => {
      const queuedTurn = await input.turnsRepository.getNextTurnForProcessing({ since: input.clock.now() }, tx)
      Assert.isDefined(queuedTurn)
      expect(queuedTurn).toStrictEqual({ gameId: input.gameId, turn: input.turn })
      observed = structuredClone(
        await input.turnsRepository.startTurnProcessing({ turn: queuedTurn, processingStartedAt: input.clock.now() }, tx),
      )
      throw new TransactionRollbackError(message)
    }),
  ).rejects.toMatchObject({ name: "TransactionRollbackError", message })

  // Assert: the intentional rollback returned the copied, naturally parsed production input.
  Assert.isDefined(observed)
  expect(observed).toMatchObject({ gameId: input.gameId, turn: input.turn })
  return observed
}

export function reverseObjectPropertyOrder<Value>(value: Value): Value {
  if (Array.isArray(value)) {
    for (const nestedValue of value) {
      reverseObjectPropertyOrder(nestedValue)
    }
    return value
  }
  if (!isPlainRecord(value)) {
    return value
  }
  const entries = Object.entries(value).map(([key, nestedValue]) => [key, nestedValue] as const)
  for (const [, nestedValue] of entries) {
    reverseObjectPropertyOrder(nestedValue)
  }
  for (const [key] of entries) {
    Reflect.deleteProperty(value, key)
  }
  for (const [key, nestedValue] of entries.toReversed()) {
    Reflect.set(value, key, nestedValue)
  }
  return value
}

export function replayObservedTurn(observed: TurnToProcessModel, reverseRows: boolean): ReplayObservedTurnResult {
  // Arrange: each replay permutes only copied record keys and row order; semantic arrays retain their ordinals.
  const copiedObserved = structuredClone(observed)
  const input = reverseRows ? reverseObjectPropertyOrder(copiedObserved) : copiedObserved
  const submittedActions = reverseRows ? [...input.submittedActions].toReversed() : [...input.submittedActions]
  const players = indexBy("id", reverseRows ? Object.values(input.players).toReversed() : Object.values(input.players))
  const planets = indexBy("id", reverseRows ? Object.values(input.planets).toReversed() : Object.values(input.planets))
  const fleets = indexBy("id", reverseRows ? Object.values(input.fleets).toReversed() : Object.values(input.fleets))
  const rng = Rng.fromState(input.rngState, mulberry32Prng)

  // Act: the separately labeled shared replay resolves only this copied input and its restored natural generator.
  const resolved = resolveTurn(
    {
      gameId: input.gameId,
      turn: input.turn,
      submittedActions,
      players,
      planets,
      fleets,
      winnerPlayerId: undefined,
    },
    input.ruleset,
    rng,
  )
  Assert.isSuccess(resolved)

  // Assert: return the complete replayed outcomes and resulting RNG state for comparison with persisted observation.
  return { resolved: resolved.value, rngState: rng.getState() }
}

export function mulberry32DrawAt(generatorState: number): Mulberry32DrawAtResult {
  // Arrange: derive a draw independently from the installed tools-ts generator.
  const nextGeneratorState = (generatorState + 0x6d2b79f5) >>> 0
  let value = nextGeneratorState
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  const draw = ((value ^ (value >>> 14)) >>> 0) / 4294967296
  return { value: draw, nextGeneratorState }
}

export function mulberry32FirstDraw(generatorState: number): Mulberry32FirstDrawResult {
  // Assert: the independent implementation matches tools-ts at the observed state and the fixed seed-1234 oracle.
  const draw = mulberry32DrawAt(generatorState)
  const toolsOracle = Rng.create(mulberry32Prng(generatorState))
  expect(toolsOracle.float()).toBe(draw.value)
  const seed1234Oracle = Rng.create(mulberry32Prng(1234))
  expect(seed1234Oracle.float()).toBe(0.07329497812315822)
  return draw
}

export function mulberry32DrawSequence(generatorState: number, count: number): Mulberry32DrawSequenceResult {
  const draws: Array<{ value: number; nextGeneratorState: number }> = []
  let nextGeneratorState = generatorState
  const toolsOracle = Rng.create(mulberry32Prng(generatorState))
  for (let index = 0; index < count; index += 1) {
    const draw = mulberry32DrawAt(nextGeneratorState)
    expect(toolsOracle.float()).toBe(draw.value)
    draws.push(draw)
    nextGeneratorState = draw.nextGeneratorState
  }
  return { draws, finalGeneratorState: nextGeneratorState }
}

export function normalizedOutcomeSequence(resolved: ResolvedTurnState): Array<{
  playerId: PlayerId
  actionId: string
  outcomes: readonly EffectOutcome[]
}> {
  return resolved.resolvedActions
    .toSorted((first, second) => {
      const ownerOrder = compareOrdinalStrings(first.submittedAction.playerId, second.submittedAction.playerId)
      return ownerOrder === 0 ? compareOrdinalStrings(first.submittedAction.id, second.submittedAction.id) : ownerOrder
    })
    .map(({ submittedAction, actionOutcomes }) => ({
      playerId: submittedAction.playerId,
      actionId: submittedAction.id,
      outcomes: actionOutcomes,
    }))
}

export function outcomeForOwner(resolved: ResolvedTurnState, playerId: PlayerId | undefined, actionId?: string): EffectOutcome | undefined {
  if (playerId === undefined) {
    return undefined
  }
  const action = resolved.resolvedActions.find(
    ({ submittedAction }) => submittedAction.playerId === playerId && (actionId === undefined || submittedAction.id === actionId),
  )
  return action?.actionOutcomes.at(-1)
}

export function ownerFleetForces(
  resolved: ResolvedTurnState,
  playerIds: readonly PlayerId[],
  planetId?: string,
): Record<PlayerId, number[]> {
  return Object.fromEntries(
    playerIds.map((playerId) => [
      playerId,
      Object.values(resolved.fleets)
        .filter(
          ({ ownerPlayerId, originPlanetId }) => ownerPlayerId === playerId && (planetId === undefined || originPlanetId === planetId),
        )
        .map(({ strength }) => strength)
        .toSorted((first, second) => first - second),
    ]),
  )
}

export function ownerPublicForces(
  fleets: PlayerView["fleets"],
  playerIds: readonly PlayerId[],
  planetId?: string,
): Record<PlayerId, number[]> {
  return Object.fromEntries(
    playerIds.map((playerId) => [
      playerId,
      fleets
        .filter(
          ({ ownerPlayerId, originPlanetId }) => ownerPlayerId === playerId && (planetId === undefined || originPlanetId === planetId),
        )
        .map(({ strength }) => strength)
        .toSorted((first, second) => first - second),
    ]),
  )
}

export function getActionToSubmintegrationTest(
  playerView: PlayerView,
  actionDefinitionId: ActionDefinitionId,
  selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]> = {},
  selectedInputs: DeepUnbranded<NonNullable<SubmittedActionTargetsDto["selectedInputs"]>> = {},
): DeepUnbranded<SubmittedActionTargetsDto> {
  const action = playerView.actions.find((availableAction) => availableAction.actionDefinitionId === actionDefinitionId)
  Assert.isDefined(action)
  return {
    actionId: action.id,
    selectedTargets,
    selectedInputs,
  }
}

export class FailingTurnsRepository extends TurnsRepository {
  private readonly failingGameId: number

  public shouldFail = true

  public constructor({
    db,
    logger,
    failingGameId,
  }: ConstructorParameters<typeof TurnsRepository>[0] & {
    failingGameId: number
  }) {
    super({ db, logger })
    this.failingGameId = failingGameId
  }

  public override async saveProcessedTurn(processedTurn: ProcessedTurnModel): Promise<Result<{ saved: true }, string>> {
    if (processedTurn.gameId === this.failingGameId && this.shouldFail) {
      return Result.Failure("Expected turn save failure")
    }

    return await super.saveProcessedTurn(processedTurn)
  }
}

export function logWorkerObservation(label: string, serializedObservation: string): void {
  Logger.get().info(`${label} ${serializedObservation}`)
}

async function verifyBuildRound(input: VerifyBuildRoundInput): Promise<void> {
  for (let buildRound = 0; buildRound < 3; buildRound += 1) {
    const views = await Promise.all(
      input.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
    )
    for (let ownerIndex = 0; ownerIndex < input.clients.length; ownerIndex += 1) {
      const buildCount = ownerIndex === 0 ? 3 : ownerIndex === 1 ? 2 : 1
      const client = input.clients[ownerIndex]
      const view = views[ownerIndex]
      const home = input.homes[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      if (buildRound < buildCount) {
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId: input.gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
        })
      }
    }
    const view = views[0]
    Assert.isDefined(view)
    await processPublicTurn({ ...input, turn: view.turn })
  }
}

async function verifyActionSelections(input: VerifyActionSelectionsInput): Promise<void> {
  expect([input.builtFleetA.strength, input.builtFleetB.strength, input.builtFleetC.strength]).toStrictEqual([30, 20, 10])

  // Act: send each complete force through the public Move action to the fixed common planet.
  for (let ownerIndex = 0; ownerIndex < input.clients.length; ownerIndex += 1) {
    const client = input.clients[ownerIndex]
    Assert.isDefined(client)
    const view = await client.client.gameplay.getPlayerView.query({ gameId: input.gameId })
    const fleet = input.builtFleets[ownerIndex]
    Assert.isDefined(view)
    Assert.isDefined(fleet)
    await client.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: view.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        view,
        MoveFleetExceptional.id,
        { fleet: fleet.id, planet: input.target.id },
        { strength: fleet.strength },
      ),
    })
  }
  const departureView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  await processPublicTurn({ ...input, turn: departureView.turn })
}

type CreateThreeOwnerStationedAssaultFixtureInput = {
  db: Database
  clock: ControlledClock
  apiServer: ApiServer
}

type ProcessPublicTurnInput = {
  clients: readonly AuthenticatedApiClient[]
  gameId: number
  turn: number
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
  process?: boolean
}

type ObserveTurnAndRollbackInput = {
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  gameId: number
  turn: number
}

type ReplayObservedTurnResult = { resolved: ResolvedTurnState; rngState: RngState<number> }

type Mulberry32DrawAtResult = { value: number; nextGeneratorState: number }

type Mulberry32FirstDrawResult = { value: number; nextGeneratorState: number }

type Mulberry32DrawSequenceResult = { draws: Array<{ value: number; nextGeneratorState: number }>; finalGeneratorState: number }

type VerifyBuildRoundInput = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  homes: readonly [Planet, Planet, Planet]
  turnProcessor: TurnProcessor
}

type VerifyActionSelectionsInput = {
  builtFleetA: Fleet
  builtFleetB: Fleet
  builtFleetC: Fleet
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  builtFleets: Array<undefined | Fleet>
  target: Planet
  alice: AuthenticatedApiClient
  turnProcessor: TurnProcessor
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false
  }
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

async function createAliceSetup(input: CreateAliceSetupInput): Promise<CreateAliceSetupResult> {
  const alice = await input.apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
  const bob = await input.apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
  const carol = await input.apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000003" })
  const clients = [alice, bob, carol] as const
  const playerAId = branded<PlayerId>(alice.account.id)
  const playerBId = branded<PlayerId>(bob.account.id)
  const playerCId = branded<PlayerId>(carol.account.id)
  const playerIds = [playerAId, playerBId, playerCId] as const
  const turnInterval = Time.create(10, UnitOfTime.SECONDS)
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: AssaultWorkerRuleset.id,
      nbSeats: 3,
      turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await carol.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: input.db, clock: input.clock })
  const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const target = planets.find(({ coordinates }) => coordinates === "45:83:40")
  Assert.isDefined(target)
  const homeA = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerAId)
  const homeB = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerBId)
  const homeC = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerCId)
  return { alice, clients, playerIds, gameId, turnProcessor, turnsRepository, target, homeA, homeB, homeC }
}

async function createSecondTransitViewSetup(input: CreateSecondTransitViewSetupInput): Promise<CreateSecondTransitViewSetupResult> {
  const transitA = input.firstTransit[0]
  const transitB = input.firstTransit[1]
  const transitC = input.firstTransit[2]
  Assert.isDefined(transitA)
  Assert.isDefined(transitB)
  Assert.isDefined(transitC)
  expect([transitA.distanceToEnd, transitB.distanceToEnd, transitC.distanceToEnd]).toStrictEqual([
    1.3404141011226551, 7.1821526257827575, 3.039286685075407,
  ])

  // Act: reload the two first arrivals while B remains in transit, then resolve B's saved remainder.
  await processPublicTurn({ ...input, turn: input.firstTransitView.turn })
  const secondTransitView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const remainingB = secondTransitView.fleets.find(
    ({ ownerPlayerId, movement }) => ownerPlayerId === input.playerIds[1] && movement !== undefined,
  )
  Assert.isDefined(remainingB)
  expect(remainingB.distanceToEnd).toBe(2.1821526257827575)
  expect(
    secondTransitView.fleets
      .filter(
        ({ ownerPlayerId, originPlanetId, movement }) =>
          [input.playerIds[0], input.playerIds[2]].includes(ownerPlayerId) && originPlanetId === input.target.id && movement === undefined,
      )
      .map(({ ownerPlayerId, strength }) => ({ ownerPlayerId, strength }))
      .toSorted((first, second) => compareOrdinalStrings(first.ownerPlayerId, second.ownerPlayerId)),
  ).toStrictEqual([
    { ownerPlayerId: input.playerIds[0], strength: 30 },
    { ownerPlayerId: input.playerIds[2], strength: 10 },
  ])
  return { secondTransitView }
}

type CreateAliceSetupInput = { apiServer: ApiServer; db: Database; clock: ControlledClock }

type CreateAliceSetupResult = {
  alice: AuthenticatedApiClient
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  gameId: GameId
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  target: Planet
  homeA: undefined | Planet
  homeB: undefined | Planet
  homeC: undefined | Planet
}

type CreateSecondTransitViewSetupInput = {
  firstTransit: Array<undefined | Fleet>
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  firstTransitView: PlayerView
  turnProcessor: TurnProcessor
  alice: AuthenticatedApiClient
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  target: Planet
}

type CreateSecondTransitViewSetupResult = { secondTransitView: PlayerView }

const expectedThreeOwnerHomes = {
  target: {
    id: "57c1b320-c267-5c9b-a5a5-1b5a02823714",
    name: "planet 552840",
    coordinates: "45:83:40",
    x: 53.24122006799319,
    y: 48.68601626316641,
  },
  homes: [
    {
      playerId: "00000000-0000-4000-8000-000000000001",
      id: "f92f944d-b247-52fa-ab94-58627375cd87",
      name: "planet 872951",
      coordinates: "54:28:25",
      x: 48.103346707667825,
      y: 52.401269727867565,
      distance: 6.340414101122655,
    },
    {
      playerId: "00000000-0000-4000-8000-000000000002",
      id: "ba9892e3-c082-59b5-a22d-0acf87b77b58",
      name: "planet 53347",
      coordinates: "46:95:40",
      x: 65.3540419094844,
      y: 49.983856636309184,
      distance: 12.182152625782757,
    },
    {
      playerId: "00000000-0000-4000-8000-000000000003",
      id: "e3099011-2516-5087-9276-8466867a3aaa",
      name: "planet 811151",
      coordinates: "44:36:25",
      x: 46.74290769550233,
      y: 43.95293410516799,
      distance: 8.039286685075407,
    },
  ],
}

function findFleetAtLocation(view: PlayerView, owner: PlayerId, origin: Planet["id"], inTransit: boolean): Fleet | undefined {
  return view.fleets.find(
    (fleet) =>
      fleet.ownerPlayerId === owner &&
      fleet.originPlanetId === origin &&
      (inTransit ? fleet.movement !== undefined : fleet.movement === undefined),
  )
}
