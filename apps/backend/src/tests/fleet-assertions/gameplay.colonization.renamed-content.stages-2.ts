import { Assert } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Fleet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { AssertLaterReplayResult } from "#tests/fleet-assertions/gameplay.colonization.renamed-content.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { getPlanets, getFleetAt, captureWorkerInput, replayWorkerInputWithState } from "../colonization/gameplay.colonization.scenarios.ts"
import { required, matchesPublicFleet, readViews } from "../colonization/gameplay.colonization.ts"
import { assertLaterReplay } from "./gameplay.colonization.renamed-content.ts"

export async function createBobJourneyIdSetup({
  clients,
  gameId,
  server,
  clock,
  turnsRepository,
  target,
  stagedFriendly,
  bobColonizeActionId,
  turnProcessor,
}: CreateBobJourneyIdSetupInput): Promise<CreateBobJourneyIdSetupResult> {
  const selectedViews = await readViews(clients, gameId)
  expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 493, uncommitted: 465 })
  expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })

  const finalTurnInput = await captureWorkerInput({
    server,
    clock,
    turnsRepository,
    gameId,
    turn: required(selectedViews[0]).turn,
  })
  const firstReplay = replayWorkerInputWithState(finalTurnInput)
  Assert.isSuccess(firstReplay.resolved)
  Assert.isSuccess(firstReplay.resolved)
  expect(firstReplay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(required(selectedViews[0]).player.id)
  Assert.isSuccess(firstReplay.resolved)
  expect(firstReplay.resolved.value.fleets[stagedFriendly.id]).toMatchObject({
    id: stagedFriendly.id,
    name: stagedFriendly.name,
    ownerPlayerId: required(selectedViews[0]).player.id,
    originPlanetId: target.id,
    strength: 20,
  })
  Assert.isSuccess(firstReplay.resolved)
  const bobJourney = Object.values(firstReplay.resolved.value.fleets).find((fleet) =>
    matchesPublicFleet(fleet, { ownerPlayerId: required(selectedViews[1]).player.id, movementSubmissionId: bobColonizeActionId }),
  )
  Assert.isDefined(bobJourney)
  const bobJourneyId = bobJourney.id
  expect(bobJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(firstReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  return { bobJourneyId }
}

export type CreateBobJourneyIdSetupInput = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  target: Planet
  stagedFriendly: Fleet
  bobColonizeActionId: string
  turnProcessor: TurnProcessor
}

export type CreateBobJourneyIdSetupResult = { bobJourneyId: FleetId }

export async function createUpdatedVerifyLaterReplaySetup({
  views,
  target,
  stagedFriendly,
  homeA,
  bobJourneyId,
  aliceColonizeActionId,
  bobColonizeActionId,
  server,
  clock,
  turnsRepository,
  gameId,
  turnProcessor,
  clients,
  ordinaryActionId,
}: CreateUpdatedVerifyLaterReplaySetupInput): Promise<CreateUpdatedVerifyLaterReplaySetupResult> {
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(required(views[0]).player.id)
  expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 20)).toMatchObject({
    id: stagedFriendly.id,
    name: stagedFriendly.name,
  })
  expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 20)).toBeDefined()
  expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 465, uncommitted: 465 })
  const pendingBob = required(views[1]).fleets.find(({ id }) => id === bobJourneyId)
  Assert.isDefined(pendingBob)
  expect(pendingBob.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(required(views[0]).actions.find(({ id }) => id === aliceColonizeActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(required(views[1]).actions.find(({ id }) => id === bobColonizeActionId)).toMatchObject({ isInProgress: true })

  const laterTurnInput = await captureWorkerInput({
    server,
    clock,
    turnsRepository,
    gameId,
    turn: required(views[0]).turn,
  })
  const laterReplay = replayWorkerInputWithState(laterTurnInput)
  Assert.isSuccess(laterReplay.resolved)

  Assert.isSuccess(laterReplay.resolved)
  const assertLaterReplayPhase4Value1 = laterReplay.resolved.value

  const updatedVerifyLaterReplay = await assertLaterReplay({
    assertLaterReplayPhase4Value1,
    target,
    views,
    bobJourneyId,
    bobColonizeActionId,
    laterReplay,
    laterTurnInput,
    turnProcessor,
    clients,
    gameId,
    stagedFriendly,
    ordinaryActionId,
  })
  return { updatedVerifyLaterReplay }
}

export type CreateUpdatedVerifyLaterReplaySetupInput = {
  views: PlayerView[]
  target: Planet
  stagedFriendly: Fleet
  homeA: Planet
  bobJourneyId: FleetId
  aliceColonizeActionId: string
  bobColonizeActionId: string
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  gameId: number
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  ordinaryActionId: string
}

export type CreateUpdatedVerifyLaterReplaySetupResult = { updatedVerifyLaterReplay: AssertLaterReplayResult }
