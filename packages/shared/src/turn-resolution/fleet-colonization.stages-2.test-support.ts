import { Assert } from "@guillaume-docquier/tools-ts"
import { expect } from "vitest"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { resolveColonizationPhase } from "#shared/turn-resolution/phases/implementations/resolveColonizationPhase.ts"
import { resolveFleetCombatPhase } from "#shared/turn-resolution/phases/implementations/resolveFleetCombatPhase.ts"
import { resolveFleetMovementPhase } from "#shared/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import { PLAYER_A, resolveContinuation } from "./fleet-colonization.test-support.ts"

export function createEdgeArrivalSetup({
  edgeDeparture,
  ruleset,
  edgeJourney,
  edgeSite,
}: CreateEdgeArrivalSetupInput): CreateEdgeArrivalSetupResult {
  const edgePhaseProbeContext: TurnContext = {
    rng: createSeededRng(1234),
    turnState: createTurnStateStub({
      gameId: edgeDeparture.gameId,
      turn: 2,
      players: structuredClone(edgeDeparture.players),
      planets: structuredClone(edgeDeparture.planets),
      fleets: structuredClone(edgeDeparture.fleets),
    }),
    effectPool: new EffectPool([]),
    ruleset,
    previousJourneyFleetIds: [edgeJourney.id],
    newDepartureFleetIds: new Set(),
    removedFleetIds: new Set(),
    changedPlanetIds: new Set(),
    resolvedContinuations: [],
    pendingArrivalAssaults: [],
    pendingArrivalColonizations: [],
    fleetIdRebindings: new Map(),
  }
  Assert.isSuccess(resolveFleetMovementPhase(edgePhaseProbeContext))
  expect(edgePhaseProbeContext.turnState.fleets[edgeJourney.id]).toMatchObject({
    id: edgeJourney.id,
    originPlanetId: edgeSite.id,
    strength: 30,
    destinationPlanetId: undefined,
    distanceToEnd: undefined,
    movement: undefined,
    arrivedAtTick: 10,
  })
  expect(edgePhaseProbeContext.pendingArrivalColonizations).toMatchObject([
    { tick: 10, actualFleetId: edgeJourney.id, planetId: edgeSite.id },
  ])
  Assert.isSuccess(resolveFleetCombatPhase(edgePhaseProbeContext))
  expect(edgePhaseProbeContext.turnState.fleets[edgeJourney.id]?.strength).toBe(30)
  Assert.isSuccess(resolveColonizationPhase(edgePhaseProbeContext))
  expect(edgePhaseProbeContext.turnState.planets[edgeSite.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(edgePhaseProbeContext.turnState.fleets[edgeJourney.id]).toBeUndefined()
  expect([...edgePhaseProbeContext.removedFleetIds]).toContain(edgeJourney.id)
  expect(edgePhaseProbeContext.turnState.players[PLAYER_A]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 43,
    [ResourceType.FUEL]: 98,
  })
  expect(edgePhaseProbeContext.resolvedContinuations[0]?.actionOutcomes.at(-1)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("colonized Planet"),
  })

  const edgeArrival = resolveContinuation(edgeDeparture, 2, createSeededRng(1234), ruleset)
  return { edgeArrival }
}

export type CreateEdgeArrivalSetupInput = {
  edgeDeparture: ResolvedTurnState
  ruleset: Ruleset
  edgeJourney: ResolutionFleet
  edgeSite: ReturnType<typeof createPlanetStub>
}

export type CreateEdgeArrivalSetupResult = { edgeArrival: ResolvedTurnState }
