import { branded, indexBy, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema } from "#shared/domain/world/fleets/FleetName.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { PlanetNameSchema } from "#shared/domain/world/planets/PlanetName.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { FleetMoveEffect } from "#shared/turn-resolution/effects/implementations/FleetMoveEffect.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

describe("FleetMoveEffect", () => {
  it("should record every outcome when a fleet arrives", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, v4())
    const fleetId = branded<FleetId>("fleet-id")
    const originPlanetId = branded<PlanetId>("origin-planet-id")
    const destinationPlanetId = branded<PlanetId>("destination-planet-id")
    const fleetName = typedParse(FleetNameSchema, "Explorer")
    const destinationPlanetName = typedParse(PlanetNameSchema, "Destination")
    const submittedAction = createSubmittedActionStub({
      playerId,
      selectedTargets: { fleet: fleetId, planet: destinationPlanetId },
      selectedInputs: { strength: 5 },
    })
    const effect = new FleetMoveEffect(
      1,
      FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 10 }),
      submittedAction,
    )
    const effectPool = new EffectPool([effect])
    const context: TurnContext = {
      rng: createSeededRng(),
      ruleset: TestRuleset,
      effectPool,
      turnState: createTurnStateStub({
        planets: indexBy("id", [
          { id: originPlanetId, name: typedParse(PlanetNameSchema, "Origin"), ownerPlayerId: playerId, x: 0, y: 0 },
          { id: destinationPlanetId, name: destinationPlanetName, ownerPlayerId: playerId, x: 5, y: 0 },
        ]),
        fleets: indexBy("id", [createFleetStub({ id: fleetId, name: fleetName, ownerPlayerId: playerId, originPlanetId, strength: 5 })]),
      }),
      previousJourneyFleetIds: [],
      newDepartureFleetIds: new Set(),
      removedFleetIds: new Set(),
      resolvedContinuations: [],
      pendingArrivalAssaults: [],
      fleetIdRebindings: new Map(),
    }
    const expectedOutcomes = [
      EffectOutcome.Resolved({
        result: `Fleet "${fleetName}" sent 5 Strength from Planet "Origin" towards Planet "${destinationPlanetName}"`,
      }),
    ]

    // Act
    const result = effect.resolve(context)

    // Assert
    expect(result).toStrictEqual<typeof result>(Result.Success(expectedOutcomes))
    expect(effectPool.getOutcomes(submittedAction)).toStrictEqual(expectedOutcomes)
    expect(effectPool.isEmpty()).toBe(true)
    expect(context.turnState.fleets[fleetId]).toBeUndefined()
    expect(context.removedFleetIds).toStrictEqual(new Set([fleetId]))
    const departureFleet = Object.values(context.turnState.fleets)[0]
    expect(departureFleet?.id).not.toBe(fleetId)
    expect(departureFleet).toMatchObject({
      ownerPlayerId: playerId,
      name: fleetName,
      strength: 5,
      originPlanetId,
      destinationPlanetId,
      distanceToEnd: 5,
      movement: { speed: 10, departureTurn: 1, submission: submittedAction, pendingArrivalEffects: [] },
    })
  })
})
