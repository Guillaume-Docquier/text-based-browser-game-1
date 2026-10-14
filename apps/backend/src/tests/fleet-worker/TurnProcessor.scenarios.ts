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
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { expect } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ApiServer } from "#tests/ApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { type ProcessedTurnModel, type TurnToProcessModel, TurnsRepository } from "#turn-processing/turns.repository.ts"
import { AssaultWorkerRuleset, type ThreeOwnerStationedAssaultFixture } from "./TurnProcessor.ts"

export async function createThreeOwnerStationedAssaultFixture({
  db,
  clock,
  apiServer,
}: {
  db: Database
  clock: ControlledClock
  apiServer: ApiServer
}): Promise<ThreeOwnerStationedAssaultFixture> {
  const alice = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
  const bob = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
  const carol = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000003" })
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
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const target = planets.find(({ coordinates }) => coordinates === "45:83:40")
  Assert.isDefined(target)
  const homeA = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerAId)
  const homeB = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerBId)
  const homeC = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerCId)
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
  }).toStrictEqual({
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
  })

  // Arrange: build literal A30/B20/C10 through public Build submissions and completed actual-worker turns.
  for (let buildRound = 0; buildRound < 3; buildRound += 1) {
    const views = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
      const buildCount = ownerIndex === 0 ? 3 : ownerIndex === 1 ? 2 : 1
      const client = clients[ownerIndex]
      const view = views[ownerIndex]
      const home = homes[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      if (buildRound < buildCount) {
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
        })
      }
    }
    const view = views[0]
    Assert.isDefined(view)
    await processPublicTurn({ clients, gameId, turn: view.turn, turnProcessor })
  }

  // Assert: public worker builds have independently established force inputs before staging.
  const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const builtFleets = homes.map((home, index) => {
    const playerId = playerIds[index]
    Assert.isDefined(playerId)
    return builtView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerId && originPlanetId === home.id && movement === undefined,
    )
  })
  const builtFleetA = builtFleets[0]
  const builtFleetB = builtFleets[1]
  const builtFleetC = builtFleets[2]
  Assert.isDefined(builtFleetA)
  Assert.isDefined(builtFleetB)
  Assert.isDefined(builtFleetC)
  expect([builtFleetA.strength, builtFleetB.strength, builtFleetC.strength]).toStrictEqual([30, 20, 10])

  // Act: send each complete force through the public Move action to the fixed common planet.
  for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
    const client = clients[ownerIndex]
    Assert.isDefined(client)
    const view = await client.client.gameplay.getPlayerView.query({ gameId })
    const fleet = builtFleets[ownerIndex]
    Assert.isDefined(view)
    Assert.isDefined(fleet)
    await client.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        view,
        MoveFleetExceptional.id,
        { fleet: fleet.id, planet: target.id },
        { strength: fleet.strength },
      ),
    })
  }
  const departureView = await alice.client.gameplay.getPlayerView.query({ gameId })
  await processPublicTurn({ clients, gameId, turn: departureView.turn, turnProcessor })
  const firstTransitView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const firstTransit = homes.map((home, index) => {
    const playerId = playerIds[index]
    Assert.isDefined(playerId)
    return firstTransitView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerId && originPlanetId === home.id && movement !== undefined,
    )
  })
  const transitA = firstTransit[0]
  const transitB = firstTransit[1]
  const transitC = firstTransit[2]
  Assert.isDefined(transitA)
  Assert.isDefined(transitB)
  Assert.isDefined(transitC)
  expect([transitA.distanceToEnd, transitB.distanceToEnd, transitC.distanceToEnd]).toStrictEqual([
    1.3404141011226551, 7.1821526257827575, 3.039286685075407,
  ])

  // Act: reload the two first arrivals while B remains in transit, then resolve B's saved remainder.
  await processPublicTurn({ clients, gameId, turn: firstTransitView.turn, turnProcessor })
  const secondTransitView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const remainingB = secondTransitView.fleets.find(
    ({ ownerPlayerId, movement }) => ownerPlayerId === playerIds[1] && movement !== undefined,
  )
  Assert.isDefined(remainingB)
  expect(remainingB.distanceToEnd).toBe(2.1821526257827575)
  expect(
    secondTransitView.fleets
      .filter(
        ({ ownerPlayerId, originPlanetId, movement }) =>
          [playerIds[0], playerIds[2]].includes(ownerPlayerId) && originPlanetId === target.id && movement === undefined,
      )
      .map(({ ownerPlayerId, strength }) => ({ ownerPlayerId, strength }))
      .toSorted((first, second) => compareOrdinalStrings(first.ownerPlayerId, second.ownerPlayerId)),
  ).toStrictEqual([
    { ownerPlayerId: playerIds[0], strength: 30 },
    { ownerPlayerId: playerIds[2], strength: 10 },
  ])
  await processPublicTurn({ clients, gameId, turn: secondTransitView.turn, turnProcessor })
  const stationedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const stationed = homes.map((home, index) => {
    const playerId = playerIds[index]
    Assert.isDefined(playerId)
    return stationedView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerId && originPlanetId === target.id && movement === undefined,
    )
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

export async function processPublicTurn({
  clients,
  gameId,
  turn,
  turnProcessor,
  process = true,
}: {
  clients: readonly AuthenticatedApiClient[]
  gameId: number
  turn: number
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
  process?: boolean
}): Promise<void> {
  await Promise.all(clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })))
  if (process) {
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  }
}

export async function observeTurnAndRollback({
  db,
  clock,
  turnsRepository,
  gameId,
  turn,
}: {
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  gameId: number
  turn: number
}): Promise<TurnToProcessModel> {
  // Arrange: the public readiness route has closed the requested turn before acquiring the production repository lock.
  let observed: TurnToProcessModel | undefined
  const message = `Intentional I2-06 observation rollback for game ${gameId} turn ${turn}`

  // Act: copy the production-parsed input, then force the same transaction to undo PROCESSING and lock changes.
  await expect(
    db.transaction(async (tx) => {
      const queuedTurn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
      Assert.isDefined(queuedTurn)
      expect(queuedTurn).toStrictEqual({ gameId, turn })
      observed = structuredClone(await turnsRepository.startTurnProcessing({ turn: queuedTurn, processingStartedAt: clock.now() }, tx))
      throw new TransactionRollbackError(message)
    }),
  ).rejects.toMatchObject({ name: "TransactionRollbackError", message })

  // Assert: the intentional rollback returned the copied, naturally parsed production input.
  Assert.isDefined(observed)
  expect(observed).toMatchObject({ gameId, turn })
  return observed
}

export function reverseObjectPropertyOrder<Value>(value: Value): Value {
  if (Array.isArray(value)) {
    for (const nestedValue of value) {
      reverseObjectPropertyOrder(nestedValue)
    }
    return value
  }
  if (
    value === null ||
    typeof value !== "object" ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
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

export function replayObservedTurn(
  observed: TurnToProcessModel,
  reverseRows: boolean,
): { resolved: ResolvedTurnState; rngState: RngState<number> } {
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

export function mulberry32DrawAt(generatorState: number): { value: number; nextGeneratorState: number } {
  // Arrange: derive a draw independently from the installed tools-ts generator.
  const nextGeneratorState = (generatorState + 0x6d2b79f5) >>> 0
  let value = nextGeneratorState
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  const draw = ((value ^ (value >>> 14)) >>> 0) / 4294967296
  return { value: draw, nextGeneratorState }
}

export function mulberry32FirstDraw(generatorState: number): { value: number; nextGeneratorState: number } {
  // Assert: the independent implementation matches tools-ts at the observed state and the fixed seed-1234 oracle.
  const draw = mulberry32DrawAt(generatorState)
  const toolsOracle = Rng.create(mulberry32Prng(generatorState))
  expect(toolsOracle.float()).toBe(draw.value)
  const seed1234Oracle = Rng.create(mulberry32Prng(1234))
  expect(seed1234Oracle.float()).toBe(0.07329497812315822)
  return draw
}

export function mulberry32DrawSequence(
  generatorState: number,
  count: number,
): { draws: Array<{ value: number; nextGeneratorState: number }>; finalGeneratorState: number } {
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
