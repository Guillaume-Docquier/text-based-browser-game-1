import { branded, indexBy, Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { createSubmittedActionStub } from "#game-rules/action-submission/Action.stub.ts"
import type { FleetId } from "#game-rules/models/FleetId.ts"
import { FleetNameSchema } from "#game-rules/models/FleetName.ts"
import type { PlanetId } from "#game-rules/models/PlanetId.ts"
import { PlanetNameSchema } from "#game-rules/models/PlanetName.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import { FleetMoveEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/FleetMoveEffectDefinition.ts"
import { TestRuleset } from "#game-rules/test-ruleset/TestRuleset.ts"
import { createSeededRng } from "#game-rules/testing/createSeededRng.ts"
import { EffectOutcome } from "#game-rules/turn-resolution/effects/EffectOutcome.ts"
import { EffectPool } from "#game-rules/turn-resolution/effects/EffectPool.ts"
import { FleetMoveEffect } from "#game-rules/turn-resolution/effects/implementations/FleetMoveEffect.ts"
import type { TurnContext } from "#game-rules/turn-resolution/TurnContext.ts"
import { createTurnStateStub } from "#game-rules/turn-resolution/TurnState.stub.ts"

describe("FleetMoveEffect", () => {
  it("should record every outcome when a fleet arrives", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
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
