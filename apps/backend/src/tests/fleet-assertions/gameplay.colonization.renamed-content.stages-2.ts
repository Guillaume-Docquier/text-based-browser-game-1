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

export async function createBobJourneyIdSetup(input: CreateBobJourneyIdSetupInput): Promise<CreateBobJourneyIdSetupResult> {
  const selectedViews = await readViews(input.clients, input.gameId)
  expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 493, uncommitted: 465 })
  expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })

  const finalTurnInput = await captureWorkerInput({ ...input, turn: required(selectedViews[0]).turn })
  const firstReplay = replayWorkerInputWithState(finalTurnInput)
  Assert.isSuccess(firstReplay.resolved)
  Assert.isSuccess(firstReplay.resolved)
  expect(firstReplay.resolved.value.planets[input.target.id]?.ownerPlayerId).toBe(required(selectedViews[0]).player.id)
  Assert.isSuccess(firstReplay.resolved)
  expect(firstReplay.resolved.value.fleets[input.stagedFriendly.id]).toMatchObject({
    id: input.stagedFriendly.id,
    name: input.stagedFriendly.name,
    ownerPlayerId: required(selectedViews[0]).player.id,
    originPlanetId: input.target.id,
    strength: 20,
  })
  Assert.isSuccess(firstReplay.resolved)
  const bobJourney = Object.values(firstReplay.resolved.value.fleets).find((fleet) =>
    matchesPublicFleet(fleet, { ownerPlayerId: required(selectedViews[1]).player.id, movementSubmissionId: input.bobColonizeActionId }),
  )
  Assert.isDefined(bobJourney)
  const bobJourneyId = bobJourney.id
  expect(bobJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(firstReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)

  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
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

export async function createUpdatedVerifyLaterReplaySetup(
  input: CreateUpdatedVerifyLaterReplaySetupInput,
): Promise<CreateUpdatedVerifyLaterReplaySetupResult> {
  expect(getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBe(
    required(input.views[0]).player.id,
  )
  expect(getFleetAt(required(input.views[0]), required(input.views[0]).player.id, input.target.id, 20)).toMatchObject({
    id: input.stagedFriendly.id,
    name: input.stagedFriendly.name,
  })
  expect(getFleetAt(required(input.views[0]), required(input.views[0]).player.id, input.homeA.id, 20)).toBeDefined()
  expect(required(input.views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 465, uncommitted: 465 })
  const pendingBob = required(input.views[1]).fleets.find(({ id }) => id === input.bobJourneyId)
  Assert.isDefined(pendingBob)
  expect(pendingBob.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(required(input.views[0]).actions.find(({ id }) => id === input.aliceColonizeActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(required(input.views[1]).actions.find(({ id }) => id === input.bobColonizeActionId)).toMatchObject({ isInProgress: true })

  const laterTurnInput = await captureWorkerInput({ ...input, turn: required(input.views[0]).turn })
  const laterReplay = replayWorkerInputWithState(laterTurnInput)
  Assert.isSuccess(laterReplay.resolved)

  Assert.isSuccess(laterReplay.resolved)
  const assertLaterReplayPhase4Value1 = laterReplay.resolved.value

  const updatedVerifyLaterReplay = await assertLaterReplay({ ...input, assertLaterReplayPhase4Value1, laterReplay, laterTurnInput })
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
