import { branded, indexBy, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
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
      selectedInputs: { strength: 10 },
      selectedTargets: { fleet: fleetId, planet: destinationPlanetId },
    })
    const effect = new FleetMoveEffect(
      1,
      FleetMoveEffectDefinition.create({ fleetTag: "fleet", strengthTag: "strength", planetTag: "planet", speed: 10 }),
      submittedAction,
    )
    const effectPool = new EffectPool([effect])
    const context: TurnContext = {
      arrivalIntents: [],
      destroyedFleetIds: new Set(),
      rng: createSeededRng(),
      ruleset: TestRuleset,
      effectPool,
      turnState: createTurnStateStub({
        planets: indexBy("id", [
          { id: originPlanetId, name: typedParse(PlanetNameSchema, "Origin"), ownerPlayerId: playerId, x: 0, y: 0 },
          { id: destinationPlanetId, name: destinationPlanetName, ownerPlayerId: playerId, x: 5, y: 0 },
        ]),
        fleets: indexBy("id", [
          {
            id: fleetId,
            name: fleetName,
            ownerPlayerId: playerId,
            originPlanetId,
            strength: 10,
          },
        ]),
      }),
    }
    const expectedOutcomes = [expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("departed with 10 strength") })]

    // Act
    const result = effect.resolve(context)

    // Assert
    expect(result).toStrictEqual<typeof result>(Result.Success(expectedOutcomes))
    expect(effectPool.getOutcomes(submittedAction)).toStrictEqual(expectedOutcomes)
    expect(effectPool.isEmpty()).toBe(true)
  })
})
