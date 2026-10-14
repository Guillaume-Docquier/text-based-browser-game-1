import { Assert } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { Planet, Fleet, PlayerView } from "#api/types.ts"
import { turnsTable } from "#lib/db/schema.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration as CapturedreverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import { findStationaryFleetAt } from "../fleet-concurrency/gameplay.ts"
import { assertPersistedAlice } from "./gameplay.ts"

export async function createPersistedAliceSetup({
  views,
  priorityTurn,
  findPlanetOwner,
  target,
  alicePlayerId,
  bobPlayerId,
  stagedAlice,
  bobArrival,
  movingStrength,
  homeB,
  bobHomeRemainderStrengths,
  aliceColonizeActionId,
  bobColonizeActionId,
  server,
  gameId,
  capturedInput,
}: CreatePersistedAliceSetupInput): Promise<CreatePersistedAliceSetupResult> {
  expect(views.map(({ turn }) => turn)).toStrictEqual([priorityTurn + 1, priorityTurn + 1])
  for (const view of views) {
    expect(findPlanetOwner(view, target.id)).toBe(alicePlayerId)
    expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  }
  const persistedAlice = findStationaryFleetAt(views[0], alicePlayerId, target.id)
  const persistedBob = findStationaryFleetAt(views[1], bobPlayerId, target.id)
  Assert.isDefined(persistedAlice)
  Assert.isDefined(persistedBob)

  assertPersistedAlice({
    persistedAlice,
    stagedAlice,
    persistedBob,
    bobArrival,
    movingStrength,
    views,
    homeB,
    bobHomeRemainderStrengths,
    bobPlayerId,
    aliceColonizeActionId,
    bobColonizeActionId,
  })

  const savedTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
  const savedNextTurn = savedTurns.find(({ turn }) => turn === priorityTurn + 1)
  Assert.isDefined(savedNextTurn)

  const assertPersistedNextRngStatePhase6CapturedInput = capturedInput
  return { persistedAlice, persistedBob, savedNextTurn, assertPersistedNextRngStatePhase6CapturedInput }
}

export type CreatePersistedAliceSetupInput = {
  views: [PlayerView, PlayerView]
  priorityTurn: number
  findPlanetOwner: (view: PlayerView, planetId: PlanetId) => undefined | null | PlayerId
  target: Planet
  alicePlayerId: PlayerId
  bobPlayerId: PlayerId
  stagedAlice: Fleet
  bobArrival: ResolutionFleet
  movingStrength: 35 | 70
  homeB: Planet
  bobHomeRemainderStrengths: readonly [5] | readonly []
  aliceColonizeActionId: string
  bobColonizeActionId: string
  server: ConcurrencyTestApiServer
  gameId: GameId
  capturedInput: ReturnType<typeof CapturedreverseWorkerInputEnumeration>
}

export type CreatePersistedAliceSetupResult = {
  persistedAlice: Fleet
  persistedBob: Fleet
  savedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  assertPersistedNextRngStatePhase6CapturedInput: undefined | ReturnType<typeof CapturedreverseWorkerInputEnumeration>
}
