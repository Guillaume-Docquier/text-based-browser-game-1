import { branded, indexBy, Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { createSubmittedActionStub } from "#shared/domain/actions/Action.stub.ts"
import { EffectOutcome } from "#shared/domain/actions/EffectOutcome.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
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
    const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")
    const fleetId = branded<FleetId>("fleet-id")
    const originPlanetId = branded<PlanetId>("origin-planet-id")
    const destinationPlanetId = branded<PlanetId>("destination-planet-id")
    const fleetName = typedParse(FleetNameSchema, "Explorer")
    const destinationPlanetName = typedParse(PlanetNameSchema, "Destination")
    const submittedAction = createSubmittedActionStub({
      playerId,
      selectedTargets: { fleet: fleetId, planet: destinationPlanetId },
    })
    const effect = new FleetMoveEffect(
      1,
      FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", speed: 10 }),
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
        fleets: indexBy("id", [
          {
            id: fleetId,
            name: fleetName,
            ownerPlayerId: playerId,
            originPlanetId,
            strength: 5,
            distanceToEnd: typedParse(NonNegativeNumberSchema, 5),
          },
        ]),
      }),
    }
    const expectedOutcomes = [
      EffectOutcome.Resolved({ result: `Fleet "${fleetName}" moved 5 light years towards Planet "${destinationPlanetName}"` }),
      EffectOutcome.Resolved({ result: `Fleet "${fleetName}" arrived on Planet "${destinationPlanetName}"` }),
    ]

    // Act
    const result = effect.resolve(context)

    // Assert
    expect(result).toStrictEqual<typeof result>(Result.Success(expectedOutcomes))
    expect(effectPool.getOutcomes(submittedAction)).toStrictEqual(expectedOutcomes)
    expect(effectPool.isEmpty()).toBe(true)
  })
})
