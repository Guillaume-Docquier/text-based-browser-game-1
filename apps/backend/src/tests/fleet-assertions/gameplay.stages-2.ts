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

export async function createPersistedAliceSetup(input: CreatePersistedAliceSetupInput): Promise<CreatePersistedAliceSetupResult> {
  expect(input.views.map(({ turn }) => turn)).toStrictEqual([input.priorityTurn + 1, input.priorityTurn + 1])
  for (const view of input.views) {
    expect(input.findPlanetOwner(view, input.target.id)).toBe(input.alicePlayerId)
    expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  }
  const persistedAlice = findStationaryFleetAt(input.views[0], input.alicePlayerId, input.target.id)
  const persistedBob = findStationaryFleetAt(input.views[1], input.bobPlayerId, input.target.id)
  Assert.isDefined(persistedAlice)
  Assert.isDefined(persistedBob)

  assertPersistedAlice({ ...input, persistedAlice, persistedBob })

  const savedTurns = await input.server.database.select().from(turnsTable).where(eq(turnsTable.gameId, input.gameId))
  const savedNextTurn = savedTurns.find(({ turn }) => turn === input.priorityTurn + 1)
  Assert.isDefined(savedNextTurn)

  const assertPersistedNextRngStatePhase6CapturedInput = input.capturedInput
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
