import { Assert, branded, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { expect } from "vitest"
import type { Fleet, PlayerView, Action, Planet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ApiServer } from "#tests/ApiServer.ts"
import type { createPublicHomeArrivalFixture as CapturedcreatePublicHomeArrivalFixture } from "#tests/fleet-worker/TurnProcessor.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  processPublicTurn,
  observeTurnAndRollback,
  replayObservedTurn,
  normalizedOutcomeSequence,
  ownerFleetForces,
  getActionToSubmintegrationTest,
} from "../fleet-worker/TurnProcessor.scenarios.ts"
import { WorkerI207Ruleset } from "../fleet-worker/TurnProcessor.ts"
import { assertActionSelections } from "./TurnProcessor.assault-builds-2.ts"
import { assertTarget } from "./TurnProcessor.assault-builds.ts"

export async function createFinalTargetForcesSetup(input: CreateFinalTargetForcesSetupInput): Promise<CreateFinalTargetForcesSetupResult> {
  const attackArrivalObservation = await observeTurnAndRollback({
    ...input,
    turnsRepository: input.fixture.turnsRepository,
    gameId: input.fixture.gameId,
    turn: input.movingView.turn,
  })
  const attackArrivalForward = replayObservedTurn(attackArrivalObservation, false)
  const attackArrivalPermuted = replayObservedTurn(attackArrivalObservation, true)
  const finalTargetForces = { [input.playerAId]: [25], [input.playerBId]: [] }
  expect(ownerFleetForces(attackArrivalForward.resolved, input.fixture.playerIds, input.fixture.aliceHome.id)).toStrictEqual(
    finalTargetForces,
  )
  expect(ownerFleetForces(attackArrivalPermuted.resolved, input.fixture.playerIds, input.fixture.aliceHome.id)).toStrictEqual(
    finalTargetForces,
  )
  expect(normalizedOutcomeSequence(attackArrivalForward.resolved)).toStrictEqual(normalizedOutcomeSequence(attackArrivalPermuted.resolved))
  expect(attackArrivalForward.rngState).toStrictEqual(attackArrivalPermuted.rngState)
  expect(attackArrivalForward.resolved.removedFleetIds).toStrictEqual(expect.arrayContaining([input.attackJourneyId, input.enemy.id]))
  const survivingArrival = Object.values(attackArrivalForward.resolved.fleets).find(
    ({ id, ownerPlayerId, originPlanetId, strength, movement }) =>
      id === input.ordinaryArrival.id &&
      ownerPlayerId === input.playerAId &&
      originPlanetId === input.fixture.aliceHome.id &&
      strength === 25 &&
      movement === undefined,
  )
  Assert.isDefined(survivingArrival)
  expect(survivingArrival.name).toBe(input.ordinaryArrival.name)
  const attackContinuations = attackArrivalForward.resolved.resolvedContinuations.filter(
    ({ originatingSubmission }) => originatingSubmission.playerId === input.playerAId && originatingSubmission.id === input.attackAction.id,
  )
  expect(attackContinuations).toHaveLength(1)
  const attackContinuation = attackContinuations[0]
  Assert.isDefined(attackContinuation)
  return { finalTargetForces, attackContinuation }
}

export type CreateFinalTargetForcesSetupInput = {
  db: Database
  clock: ControlledClock
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  movingView: PlayerView
  playerAId: PlayerId
  playerBId: PlayerId
  attackJourneyId: FleetId
  enemy: Fleet
  ordinaryArrival: Fleet
  attackAction: Action
}

export type CreateFinalTargetForcesSetupResult = {
  finalTargetForces: Record<string, number[]>
  attackContinuation: ResolvedTurnState["resolvedContinuations"][number]
}

export async function createAliceSetup(input: CreateAliceSetupInput): Promise<CreateAliceSetupResult> {
  const alice = await input.apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
  const bob = await input.apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
  const clients = [alice, bob]
  const playerIds = [branded<PlayerId>(alice.account.id), branded<PlayerId>(bob.account.id)]
  const turnInterval = Time.create(10, UnitOfTime.SECONDS)
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: WorkerI207Ruleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: input.db, clock: input.clock })
  const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const target = planets.find(({ coordinates }) => coordinates === "45:83:40")
  const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerIds[1])
  Assert.isDefined(target)
  Assert.isDefined(bobHome)

  await assertTarget({ target, bobHome, clients, gameId, turnProcessor })

  const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const aliceInitial = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[0] && originPlanetId === target.id && movement === undefined,
  )
  const bobInitial = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[1] && originPlanetId === bobHome.id && movement === undefined,
  )
  Assert.isDefined(aliceInitial)
  Assert.isDefined(bobInitial)
  expect(aliceInitial.strength).toBe(40)
  expect(bobInitial.strength).toBe(20)

  // Act: stage ten at Bob's home. Speed5 carries it there on this worker turn, leaving defender30.
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: builtView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      builtView,
      MoveFleetExceptional.id,
      { fleet: aliceInitial.id, planet: bobHome.id },
      { strength: 10 },
    ),
  })
  await processPublicTurn({ clients, gameId, turn: builtView.turn, turnProcessor })
  const afterSplit = await alice.client.gameplay.getPlayerView.query({ gameId })
  return { alice, bob, clients, playerIds, gameId, turnProcessor, turnsRepository, target, bobHome, aliceInitial, afterSplit }
}

export type CreateAliceSetupInput = { apiServer: ApiServer; db: Database; clock: ControlledClock }

export type CreateAliceSetupResult = {
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  clients: AuthenticatedApiClient[]
  playerIds: PlayerId[]
  gameId: GameId
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  target: Planet
  bobHome: Planet
  aliceInitial: Fleet
  afterSplit: PlayerView
}

export async function createEnemyJourneySetup(input: CreateEnemyJourneySetupInput): Promise<CreateEnemyJourneySetupResult> {
  const beforeArrival = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const enemyJourney = beforeArrival.fleets.find(
    ({ ownerPlayerId, movement }) => ownerPlayerId === input.playerIds[1] && movement !== undefined,
  )
  const defender = beforeArrival.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === input.playerIds[0] && originPlanetId === input.target.id && movement === undefined,
  )
  Assert.isDefined(enemyJourney)
  Assert.isDefined(defender)
  expect(defender.strength).toBe(30)
  expect(input.aliceAtStaging.strength).toBe(10)
  expect(enemyJourney).toMatchObject({
    strength: 20,
    distanceToEnd: 0.418312565270031,
    movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
  })

  // Act: on the combat turn, submit friendly5 arrival, outgoing20 ordinary Move and Build10 together.
  const aliceFinalView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const inboundAction = aliceFinalView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetExceptional.id)
  const outboundAction = aliceFinalView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
  Assert.isDefined(inboundAction)
  Assert.isDefined(outboundAction)

  await assertActionSelections({ ...input, aliceFinalView, inboundAction, outboundAction, defender })

  // Assert: the real worker resolves arrivals, outgoing split, Build and Combat in order, preserving force identities.
  const afterCombat = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const defenderAfter = afterCombat.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === input.playerIds[0] && originPlanetId === input.target.id && movement === undefined,
  )
  const outboundJourney = afterCombat.fleets.find(
    ({ ownerPlayerId, movement }) => ownerPlayerId === input.playerIds[0] && movement?.submission.id === outboundAction.id,
  )
  Assert.isDefined(defenderAfter)
  Assert.isDefined(outboundJourney)
  return { enemyJourney, defender, afterCombat, defenderAfter, outboundJourney }
}

export type CreateEnemyJourneySetupInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  playerIds: PlayerId[]
  target: Planet
  aliceAtStaging: Fleet
  bobHome: Planet
  clients: AuthenticatedApiClient[]
  turnProcessor: TurnProcessor
}

export type CreateEnemyJourneySetupResult = {
  enemyJourney: Fleet
  defender: Fleet
  afterCombat: PlayerView
  defenderAfter: Fleet
  outboundJourney: Fleet
}
