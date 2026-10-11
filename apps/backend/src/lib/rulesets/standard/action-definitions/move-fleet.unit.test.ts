import {
  MoveFleetExceptional as TestMoveFleetExceptional,
  MoveFleetImproved as TestMoveFleetImproved,
  MoveFleetStandard as TestMoveFleetStandard,
} from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { describe, expect, it } from "vitest"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "#lib/rulesets/standard/action-definitions/move-fleet.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"

describe("Standard movement rules", () => {
  it("should keep the shipped movement ranges and speeds aligned with the stable API test rules", () => {
    // Arrange
    const expectedMovement = [
      { standard: MoveFleetStandard, test: TestMoveFleetStandard, speed: 0.1, maxDistance: 5 },
      { standard: MoveFleetImproved, test: TestMoveFleetImproved, speed: 1, maxDistance: 10 },
      { standard: MoveFleetExceptional, test: TestMoveFleetExceptional, speed: 5, maxDistance: 25 },
    ] as const

    // Act
    const observedMovement = expectedMovement.map(({ standard, test, speed, maxDistance }) => {
      const standardMove = standard.effects.find((effect) => effect.type === "FLEET_MOVE")
      const standardRange = Object.values(standard.targets)
        .flatMap(({ constraints }) => constraints)
        .find((constraint) => constraint.type === "WITHIN_FLEET_RANGE")
      const testMove = test.effects.find((effect) => effect.type === "FLEET_MOVE")
      const testRange = Object.values(test.targets)
        .flatMap(({ constraints }) => constraints)
        .find((constraint) => constraint.type === "WITHIN_FLEET_RANGE")

      return {
        actionDefinitionId: standard.id,
        expectedSpeed: speed,
        expectedMaxDistance: maxDistance,
        standardSpeed: standardMove?.parameters.speed,
        standardMaxDistance: standardRange?.parameters.maxDistance,
        testSpeed: testMove?.parameters.speed,
        testMaxDistance: testRange?.parameters.maxDistance,
        standardRulesetDefinitionId: StandardRuleset.actionDefinitions[standard.id]?.id,
        testRulesetDefinitionId: TestRuleset.actionDefinitions[test.id]?.id,
      }
    })

    // Assert
    expect(observedMovement).toStrictEqual([
      {
        actionDefinitionId: "MOVE_FLEET_STANDARD",
        expectedSpeed: 0.1,
        expectedMaxDistance: 5,
        standardSpeed: 0.1,
        standardMaxDistance: 5,
        testSpeed: 0.1,
        testMaxDistance: 5,
        standardRulesetDefinitionId: "MOVE_FLEET_STANDARD",
        testRulesetDefinitionId: "MOVE_FLEET_STANDARD",
      },
      {
        actionDefinitionId: "MOVE_FLEET_IMPROVED",
        expectedSpeed: 1,
        expectedMaxDistance: 10,
        standardSpeed: 1,
        standardMaxDistance: 10,
        testSpeed: 1,
        testMaxDistance: 10,
        standardRulesetDefinitionId: "MOVE_FLEET_IMPROVED",
        testRulesetDefinitionId: "MOVE_FLEET_IMPROVED",
      },
      {
        actionDefinitionId: "MOVE_FLEET_EXCEPTIONAL",
        expectedSpeed: 5,
        expectedMaxDistance: 25,
        standardSpeed: 5,
        standardMaxDistance: 25,
        testSpeed: 5,
        testMaxDistance: 25,
        standardRulesetDefinitionId: "MOVE_FLEET_EXCEPTIONAL",
        testRulesetDefinitionId: "MOVE_FLEET_EXCEPTIONAL",
      },
    ])
  })
})
