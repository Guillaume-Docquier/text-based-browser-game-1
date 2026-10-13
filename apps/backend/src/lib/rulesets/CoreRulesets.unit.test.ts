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
    const movement = Object.values(loaded.actionDefinitions)
      .filter((definition) => !definition.effects.some((effect) => effect.type === "ASSAULT"))
      .filter((definition) => !definition.effects.some((effect) => effect.type === "COLONIZE"))
      .filter((definition) => definition.effects.some((effect) => effect.type === "FLEET_MOVE"))
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

describe.each([
  { name: "Standard V1", speed: 1, range: 5, instances: 1 },
  { name: "Test", speed: 10, range: 25, instances: 2 },
])("persisted normal Assault content in $name", ({ name, speed, range, instances }) => {
  it("should load explicit mapped Move and Assault with independent configured parameters", () => {
    // Arrange
    const ruleset = CoreRulesets.find((ruleset) => ruleset.name === name)
    Assert.isDefined(ruleset)
    // Act
    const loaded = RulesetSchema.parse(JSON.parse(JSON.stringify(ruleset)))
    const definition = Object.values(loaded.actionDefinitions).find((definition) => definition.name === "Attack Move")
    Assert.isDefined(definition)
    // Assert
    expect(definition.effects).toStrictEqual([
      {
        type: "FLEET_MOVE",
        targets: { fleet: { actionTargetTag: "fleet", targetType: "FLEET" }, planet: { actionTargetTag: "planet", targetType: "PLANET" } },
        inputs: { strength: { actionInputTag: "strength" } },
        parameters: { speed },
      },
      {
        type: "ASSAULT",
        targets: { fleet: { actionTargetTag: "fleet", targetType: "FLEET" }, planet: { actionTargetTag: "planet", targetType: "PLANET" } },
        parameters: {},
      },
    ])
    expect(definition.costs.map((cost) => cost.parameters)).toStrictEqual([
      { quantity: 5, resourceType: "INFLUENCE" },
      { quantity: 1, resourceType: "FUEL" },
    ])
    expect(Object.values(definition.targets).find((target) => target.targetType === "PLANET")?.constraints).toStrictEqual([
      { type: "WITHIN_FLEET_RANGE", fleetTargetTag: "fleet", maximumDistance: range },
    ])
    expect(loaded.actionPool.filter((action) => action.actionDefinitionId === definition.id)).toHaveLength(instances)
  })
})

describe.each([
  { name: "Standard V1", speed: 1, range: 5, instances: 1, definitions: 14, pool: 14 },
  { name: "Test", speed: 10, range: 25, instances: 2, definitions: 14, pool: 17 },
])("persisted Colonize content in $name", ({ name, speed, range, instances, definitions, pool }) => {
  it("should retain independent bounded moving and stationary declarations after JSON reload", () => {
    // Arrange
    const ruleset = CoreRulesets.find((candidate) => candidate.name === name)
    Assert.isDefined(ruleset)
    // Act
    const loaded = RulesetSchema.parse(JSON.parse(JSON.stringify(ruleset)))
    const colonizes = Object.values(loaded.actionDefinitions).filter((definition) =>
      definition.effects.some((effect) => effect.type === "COLONIZE"),
    )
    // Assert
    expect(Object.keys(loaded.actionDefinitions)).toHaveLength(definitions)
    expect(loaded.actionPool).toHaveLength(pool)
    expect(
      colonizes.map((definition) => ({
        id: definition.id,
        costs: definition.costs.map((cost) => cost.parameters),
        inputs: definition.inputs,
        planetConstraints: Object.values(definition.targets).find((slot) => slot.targetType === "PLANET")?.constraints,
        effects: definition.effects.map((effect) => ({ type: effect.type, parameters: effect.parameters })),
      })),
    ).toStrictEqual([
      {
        id: "COLONIZE_PLANET_STANDARD",
        costs: [{ quantity: 25, resourceType: "INFLUENCE" }],
        inputs: { strength: { type: "FLEET_STRENGTH", fleetTargetTag: "fleet" } },
        planetConstraints: [{ type: "UNCLAIMED_PLANET" }, { type: "WITHIN_FLEET_RANGE", fleetTargetTag: "fleet", maximumDistance: range }],
        effects: [
          { type: "FLEET_MOVE", parameters: { speed } },
          { type: "COLONIZE", parameters: { requiredStrength: 20 } },
        ],
      },
      {
        id: "COLONIZE_STATIONED_PLANET_STANDARD",
        costs: [{ quantity: 25, resourceType: "INFLUENCE" }],
        inputs: {},
        planetConstraints: [{ type: "UNCLAIMED_PLANET" }, { type: "AT_FLEET_PLANET", fleetTargetTag: "fleet" }],
        effects: [{ type: "COLONIZE", parameters: { requiredStrength: 20 } }],
      },
    ])
    expect(loaded.actionPool.filter((entry) => entry.actionDefinitionId === "COLONIZE_PLANET_STANDARD")).toHaveLength(instances)
    expect(loaded.actionPool.filter((entry) => entry.actionDefinitionId === "COLONIZE_STATIONED_PLANET_STANDARD")).toHaveLength(1)
  })
})
