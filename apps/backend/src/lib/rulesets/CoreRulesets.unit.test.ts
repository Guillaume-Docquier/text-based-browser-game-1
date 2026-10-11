import { Assert } from "@guillaume-docquier/tools-ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import { describe, expect, it } from "vitest"
import { CoreRulesets } from "#lib/rulesets/CoreRulesets.ts"

const rulesetsById = Map.groupBy(CoreRulesets, (ruleset) => ruleset.id)
const rulesetsByName = Map.groupBy(CoreRulesets, (ruleset) => ruleset.name)

describe("CoreRulesets", () => {
  it("should only have a single default ruleset", () => {
    // Act
    const defaultRulesets = CoreRulesets.filter((ruleset) => ruleset.isDefault)

    // Assert
    expect(defaultRulesets.map((ruleset) => ruleset.name)).toStrictEqual([expect.any(String)]) // We don't care which one is the default as long as there's only 1
  })

  describe.each(CoreRulesets)("$name", (ruleset) => {
    it(`should have a unique id`, () => {
      // Act
      const rulesetsWithId = rulesetsById.getOrInsert(ruleset.id, [])

      // Assert
      expect(rulesetsWithId.map((ruleset) => ruleset.name)).toStrictEqual([ruleset.name])
    })

    it(`should have a unique name`, () => {
      // Act
      const rulesetsWithName = rulesetsByName.getOrInsert(ruleset.name, [])

      // Assert
      expect(rulesetsWithName.map((ruleset) => ruleset.id)).toStrictEqual([ruleset.id])
    })
  })
})

describe.each(CoreRulesets)("persisted movement declarations in $name", (ruleset) => {
  it("should retain the approved movement costs, speeds, ranges and mapped inputs after JSON reload", () => {
    // Arrange
    const saved = JSON.parse(JSON.stringify(ruleset))
    // Act
    const loaded = RulesetSchema.parse(saved)
    const movement = Object.values(loaded.actionDefinitions).filter((definition) =>
      definition.effects.some((effect) => effect.type === "FLEET_MOVE"),
    )
    // Assert
    expect(
      movement.map((definition) => ({
        tier: definition.tier,
        costs: definition.costs.map((cost) => cost.parameters),
        inputs: definition.inputs,
        fleetConstraints: Object.values(definition.targets).find((target) => target.targetType === "FLEET")?.constraints,
        destinationConstraints: Object.values(definition.targets).find((target) => target.targetType === "PLANET")?.constraints,
        effects: definition.effects,
      })),
    ).toStrictEqual([
      {
        tier: "STANDARD",
        costs: [
          { quantity: 3, resourceType: "INFLUENCE" },
          { quantity: 1, resourceType: "FUEL" },
        ],
        inputs: { strength: { type: "FLEET_STRENGTH", fleetTargetTag: "fleet" } },
        fleetConstraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", parameters: {}, references: {} }, { type: "STATIONARY_FLEET" }],
        destinationConstraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "fleet", maximumDistance: 5 }],
        effects: [
          {
            type: "FLEET_MOVE",
            targets: {
              fleet: { actionTargetTag: "fleet", targetType: "FLEET" },
              planet: { actionTargetTag: "planet", targetType: "PLANET" },
            },
            inputs: { strength: { actionInputTag: "strength" } },
            parameters: { speed: 0.1 },
          },
        ],
      },
      {
        tier: "IMPROVED",
        costs: [
          { quantity: 3, resourceType: "INFLUENCE" },
          { quantity: 3, resourceType: "FUEL" },
        ],
        inputs: { strength: { type: "FLEET_STRENGTH", fleetTargetTag: "fleet" } },
        fleetConstraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", parameters: {}, references: {} }, { type: "STATIONARY_FLEET" }],
        destinationConstraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "fleet", maximumDistance: 5 }],
        effects: [
          {
            type: "FLEET_MOVE",
            targets: {
              fleet: { actionTargetTag: "fleet", targetType: "FLEET" },
              planet: { actionTargetTag: "planet", targetType: "PLANET" },
            },
            inputs: { strength: { actionInputTag: "strength" } },
            parameters: { speed: 1 },
          },
        ],
      },
      {
        tier: "EXCEPTIONAL",
        costs: [
          { quantity: 3, resourceType: "INFLUENCE" },
          { quantity: 5, resourceType: "FUEL" },
        ],
        inputs: { strength: { type: "FLEET_STRENGTH", fleetTargetTag: "fleet" } },
        fleetConstraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", parameters: {}, references: {} }, { type: "STATIONARY_FLEET" }],
        destinationConstraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "fleet", maximumDistance: 25 }],
        effects: [
          {
            type: "FLEET_MOVE",
            targets: {
              fleet: { actionTargetTag: "fleet", targetType: "FLEET" },
              planet: { actionTargetTag: "planet", targetType: "PLANET" },
            },
            inputs: { strength: { actionInputTag: "strength" } },
            parameters: { speed: 5 },
          },
        ],
      },
    ])
  })

  it("should reject a persisted movement definition whose input references an absent source slot", () => {
    // Arrange
    const definition = Object.values(ruleset.actionDefinitions).find((candidate) =>
      candidate.effects.some((effect) => effect.type === "FLEET_MOVE"),
    )
    Assert.isDefined(definition)
    // Act
    const corrupted = {
      ...ruleset,
      actionDefinitions: {
        ...ruleset.actionDefinitions,
        [definition.id]: {
          ...definition,
          inputs: { strength: { type: "FLEET_STRENGTH", fleetTargetTag: "missing-source" } },
        },
      },
    }
    const loaded = RulesetSchema.safeParse(JSON.parse(JSON.stringify(corrupted)))
    // Assert
    expect(loaded.success).toBe(false)
  })
})
