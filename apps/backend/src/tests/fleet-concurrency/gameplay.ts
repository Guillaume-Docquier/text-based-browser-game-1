import { Assert, indexBy, Logger, mulberry32Prng, Rng, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { PlayerIdSchema, type PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { expect } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { Fleet, Planet, Action, GameId, PlayerView } from "#api/types.ts"
import { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type {
  actionsTable,
  fleetsTable,
  gamesTable,
  planetsTable,
  resourcesTable,
  turnsProcessingTable,
  turnsTable,
} from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnToProcessModel, TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  MANUAL_WORKER_TURN_INTERVAL,
  WorkerBuildFleetForty,
  PostgresColonizeJourneyValidationRuleset,
  PostgresArrivalAssaultRuleset,
} from "./gameplay.rulesets.ts"
import { processManualDeadlineTurn } from "./gameplay.scenarios.ts"

export type CapturedFleetMovement = NonNullable<PlayerView["fleets"][number]["movement"]>

export type PendingAssaultCorruption = {
  label: string
  expectedFailedTurnStatus: typeof TurnStatus.PROCESSING | typeof TurnStatus.AWAITING_PROCESSING
  corruptMovement: (movement: CapturedFleetMovement, otherPlayerId: PlayerView["player"]["id"]) => CapturedFleetMovement
}

export type PendingColonizeCorruption = {
  label: string
  corruptMovement: (movement: CapturedFleetMovement) => CapturedFleetMovement
}

export type PublicPendingAssaultFixture = {
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

export async function createPublicPendingAssaultFixture(server: ConcurrencyTestApiServer): Promise<PublicPendingAssaultFixture> {
  const clock = new ControlledClock({ startDate: Clock.now() })
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

  verifyCapturedJourney({ capturedJourney, bobHome, attackAction, aliceView, aliceSource, pendingView })

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

export type PublicPendingColonizeFixture = {
  player: AuthenticatedApiClient
  playerId: PlayerView["player"]["id"]
  gameId: GameId
  home: PlayerView["galaxy"]["systems"][number]["planets"][number]
  target: PlayerView["galaxy"]["systems"][number]["planets"][number]
  sourceFleet: PlayerView["fleets"][number]
  pendingView: PlayerView
  journey: PlayerView["fleets"][number]
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  clock: ControlledClock
}

export async function createPublicPendingColonizeFixture(server: ConcurrencyTestApiServer): Promise<PublicPendingColonizeFixture> {
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeJourneyValidationRuleset))
  const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000031" })
  const { createdGameId: gameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PostgresColonizeJourneyValidationRuleset.id,
      nbSeats: 1,
      turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await player.client.games.startGame.mutate({ gameId })
  const clock = new ControlledClock({ startDate: Clock.now() })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
  let view = await player.client.gameplay.getPlayerView.query({ gameId })
  const planets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
  const target = planets.find(({ coordinates }) => coordinates === "55:07:50")
  Assert.isDefined(home)
  Assert.isDefined(target)

  verifyMath({ home, target })

  const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === WorkerBuildFleetForty.id)
  Assert.isDefined(buildAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: { actionId: buildAction.id, selectedTargets: { planet: home.id }, selectedInputs: {} },
  })
  await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: view.turn })

  view = await player.client.gameplay.getPlayerView.query({ gameId })
  const sourceFleet = view.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === view.player.id && originPlanetId === home.id && movement === undefined,
  )
  Assert.isDefined(sourceFleet)
  expect(sourceFleet.strength).toBe(40)
  expect(view.resources[ResourceType.INFLUENCE].total).toBe(48)

  const colonizeAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizePlanetTest.id)
  Assert.isDefined(colonizeAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: {
      actionId: colonizeAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: target.id },
      selectedInputs: { strength: 35 },
    },
  })
  expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
    resources: { [ResourceType.INFLUENCE]: { total: 48, uncommitted: 23 } },
  })
  await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: view.turn })

  const pendingView = await player.client.gameplay.getPlayerView.query({ gameId })
  const journey = pendingView.fleets.find(({ movement }) => movement?.submission.id === colonizeAction.id)
  Assert.isDefined(journey)

  verifyJourney({ journey, target, colonizeAction, view, sourceFleet, pendingView })

  return {
    player,
    playerId: pendingView.player.id,
    gameId,
    home,
    target,
    sourceFleet,
    pendingView,
    journey,
    turnProcessor,
    turnsRepository,
    clock,
  }
}

export type GameplayRowsSnapshot = {
  fleets: Array<typeof fleetsTable.$inferSelect>
  resources: Array<typeof resourcesTable.$inferSelect>
  planets: Array<typeof planetsTable.$inferSelect>
  actions: Array<typeof actionsTable.$inferSelect>
}

export function sortGameplayRows<Row>(rows: Row[]): Row[] {
  return rows.toSorted((left, right) => compareOrdinalStrings(JSON.stringify(left) ?? "", JSON.stringify(right) ?? ""))
}

export type ColonizationPersistenceSnapshot = {
  actions: Array<typeof actionsTable.$inferSelect>
  fleets: Array<typeof fleetsTable.$inferSelect>
  games: Array<typeof gamesTable.$inferSelect>
  planets: Array<typeof planetsTable.$inferSelect>
  resources: Array<typeof resourcesTable.$inferSelect>
  turns: Array<typeof turnsTable.$inferSelect>
  turnsProcessing: Array<typeof turnsProcessingTable.$inferSelect>
}

export type RetryActionInput = {
  id: string
  playerId: string
  turn: number
  actionDefinitionId: string
  selectedTargets: unknown
  selectedInputs: unknown
}

export function projectPlayerViewActionInputs(view: PlayerView): RetryActionInput[] {
  return view.actions
    .flatMap(({ id, actionDefinitionId, selectedTargets, selectedInputs }) =>
      selectedTargets === null
        ? []
        : [{ id, playerId: view.player.id, turn: view.turn, actionDefinitionId, selectedTargets, selectedInputs }],
    )
    .toSorted((first, second) => first.id.localeCompare(second.id))
}

export function projectPersistedActionInputs(
  snapshot: ColonizationPersistenceSnapshot,
  playerId: PlayerId,
  turn: number,
): RetryActionInput[] {
  return snapshot.actions
    .flatMap(({ id, playerId: actionPlayerId, turn: actionTurn, actionDefinitionId, selectedTargets, selectedInputs }) =>
      actionPlayerId === playerId && actionTurn === turn && selectedTargets !== null
        ? [{ id, playerId: actionPlayerId, turn: actionTurn, actionDefinitionId, selectedTargets, selectedInputs }]
        : [],
    )
    .toSorted((first, second) => first.id.localeCompare(second.id))
}

export type PublicWorkerReplay = {
  resolved: ResolvedTurnState
  rngState: TurnToProcessModel["rngState"]
  actionOutcomes: Array<{
    playerId: PlayerId
    actionId: string
    outcomes: ResolvedTurnState["resolvedActions"][number]["actionOutcomes"]
  }>
}

export function compareOrdinalPair(first: string, second: string, nextFirst: string, nextSecond: string): number {
  const primaryComparison = compareOrdinalStrings(first, second)
  return primaryComparison === 0 ? compareOrdinalStrings(nextFirst, nextSecond) : primaryComparison
}

export function findPlanetOwnerInView(
  view: PlayerView,
  planetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
): PlayerId | null | undefined {
  return view.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === planetId)?.ownerPlayerId
}

export function findStationaryFleetAt(
  view: PlayerView,
  ownerPlayerId: PlayerId,
  planetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
): PlayerView["fleets"][number] | undefined {
  return view.fleets.find(
    ({ ownerPlayerId: candidateOwner, originPlanetId, movement }) =>
      candidateOwner === ownerPlayerId && originPlanetId === planetId && movement === undefined,
  )
}

export function findMovingFleetForOwner(view: PlayerView, ownerPlayerId: PlayerId): PlayerView["fleets"][number] | undefined {
  return view.fleets.find((fleet) => fleet.ownerPlayerId === ownerPlayerId && fleet.destinationPlanetId !== undefined)
}

export function findPlayerResource<T extends { playerId: string; resourceType: ResourceType }>(
  resources: readonly T[],
  playerId: PlayerId,
  resourceType: ResourceType,
): T | undefined {
  return resources.find((resource) => resource.playerId === playerId && resource.resourceType === resourceType)
}

export function hasFleetAtPlanet(
  view: PlayerView,
  ownerPlayerId: PlayerId,
  planetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
): boolean {
  return view.fleets.some((fleet) => fleet.ownerPlayerId === ownerPlayerId && fleet.originPlanetId === planetId)
}

export function areActionInstancesReleased(actions: PlayerView["actions"]): boolean {
  return actions.every(({ selectedTargets, isInProgress }) => selectedTargets === null && !isInProgress)
}

export function hasActionForTurn(actions: ReadonlyArray<{ turn: number }>, turn: number): boolean {
  return actions.some((action) => action.turn === turn)
}

export function fundingTargetsFor(
  actionDefinitionId: ActionDefinitionId,
  homePlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
): DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]> {
  if (actionDefinitionId === WorkerBuildFleetForty.id) {
    return { planet: homePlanetId }
  }
  return {}
}

export function replayWorkerInput(input: TurnToProcessModel): PublicWorkerReplay {
  const copiedInput = structuredClone(input)
  const rng = Rng.fromState(copiedInput.rngState, mulberry32Prng)
  const resolved = resolveTurn(
    {
      gameId: copiedInput.gameId,
      turn: copiedInput.turn,
      submittedActions: copiedInput.submittedActions,
      players: indexBy("id", Object.values(copiedInput.players)),
      planets: indexBy("id", Object.values(copiedInput.planets)),
      fleets: indexBy("id", Object.values(copiedInput.fleets)),
      winnerPlayerId: undefined,
    },
    copiedInput.ruleset,
    rng,
  )
  Assert.isSuccess(resolved)
  const actionOutcomes = resolved.value.resolvedActions
    .map(({ submittedAction, actionOutcomes: outcomes }) => ({
      playerId: submittedAction.playerId,
      actionId: submittedAction.id,
      outcomes,
    }))
    .toSorted((first, second) => compareOrdinalPair(first.playerId, second.playerId, first.actionId, second.actionId))
  return { resolved: resolved.value, rngState: rng.getState(), actionOutcomes }
}

export function reverseWorkerInputEnumeration(input: TurnToProcessModel): TurnToProcessModel {
  const copiedInput = structuredClone(input)
  return {
    ...copiedInput,
    submittedActions: [...copiedInput.submittedActions].toReversed(),
    players: indexBy("id", Object.values(copiedInput.players).toReversed()),
    planets: indexBy("id", Object.values(copiedInput.planets).toReversed()),
    fleets: indexBy("id", Object.values(copiedInput.fleets).toReversed()),
  }
}

export function expectedTwoPlayerTieWinner(firstDraw: number, aliceAccountId: string, bobAccountId: string): PlayerId {
  return typedParse(PlayerIdSchema, firstDraw < 0.5 ? bobAccountId : aliceAccountId)
}

export function findViewForPlayer(views: readonly PlayerView[], playerId: PlayerId): PlayerView | undefined {
  return views.find(({ player }) => player.id === playerId)
}

export function tieWinnerForce(playerId: PlayerId, winnerId: PlayerId): 15 | 35 {
  return playerId === winnerId ? 15 : 35
}

export type WorkerTieFundingRound = {
  actionDefinitionIds: readonly ActionDefinitionId[]
  expectedInfluence: number
}

export {
  TURN_INTERVAL,
  MANUAL_WORKER_TURN_INTERVAL,
  MANUAL_WORKER_CLOCK_ADVANCE,
  RULESET_ID_FOR_STRENGTH_RACES,
  RULESET_ID_FOR_RESOURCE_RACE,
  WorkerBuildFleetForty,
  PostgresColonizeWorkerRuleset,
  WorkerBuildFleetSeventy,
  ColonizePlanetSpeedFive,
  PostgresColonizeTickZeroPriorityRuleset,
  publicTickZeroPriorityScenarios,
  PostgresColonizeJourneyValidationRuleset,
  PostgresColonizeAssaultMove,
  PostgresColonizeSaveFailureRuleset,
  PostgresArrivalAssaultRuleset,
  pendingAssaultCorruptions,
  pendingColonizeCorruptions,
} from "./gameplay.rulesets.ts"

function verifyCapturedJourney({
  capturedJourney,
  bobHome,
  attackAction,
  aliceView,
  aliceSource,
  pendingView,
}: VerifyCapturedJourneyInput): void {
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
}

function verifyMath({ home, target }: VerifyMathInput): void {
  expect({ id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y }).toStrictEqual({
    id: "78821e36-f066-5df0-adbd-19785571d245",
    name: "planet 278494",
    coordinates: "45:98:30",
    x: 58.43842436611536,
    y: 49.61917707239218,
  })
  expect({ id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y }).toStrictEqual({
    id: "a34e5eae-656c-5330-ac90-9f9a7e0afa5d",
    name: "planet 684163",
    coordinates: "55:07:50",
    x: 57.77998524757335,
    y: 50.556704120958045,
  })
  expect(Math.hypot(home.x - target.x, home.y - target.y)).toBeCloseTo(1.1456435045942517, 12)
  expect(target.ownerPlayerId).toBeNull()
}

function verifyJourney({ journey, target, colonizeAction, view, sourceFleet, pendingView }: VerifyJourneyInput): void {
  expect(journey).toMatchObject({
    strength: 35,
    destinationPlanetId: target.id,

    movement: {
      speed: 1,
      submission: {
        id: colonizeAction.id,
        playerId: view.player.id,
        actionDefinitionId: ColonizePlanetTest.id,
        selectedTargets: { fleet: sourceFleet.id, planet: target.id },
        selectedInputs: { strength: 35 },
      },
      pendingArrivalEffects: [
        { definitionOrdinal: 2, effectDefinition: { type: "FLEET_COLONIZE", parameters: { strengthRequirement: 20 } } },
      ],
    },
  })
  expect(journey.distanceToEnd).toBeCloseTo(0.1456435045942517, 12)
  expect(pendingView.fleets.find(({ id }) => id === sourceFleet.id)?.strength).toBe(5)
  expect(pendingView.actions.find(({ id }) => id === colonizeAction.id)?.isInProgress).toBe(true)
  expect(pendingView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 23, uncommitted: 23 })
}

type VerifyCapturedJourneyInput = {
  capturedJourney: Fleet
  bobHome: Planet
  attackAction: Action
  aliceView: PlayerView
  aliceSource: Fleet
  pendingView: PlayerView
}

type VerifyMathInput = { home: Planet; target: Planet }

type VerifyJourneyInput = {
  journey: Fleet
  target: Planet
  colonizeAction: Action
  view: PlayerView
  sourceFleet: Fleet
  pendingView: PlayerView
}
