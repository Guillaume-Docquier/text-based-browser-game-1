import { Assert, branded, type DeepUnbranded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import {
  createActionDefinitionStub,
  createFleetMoveActionDefinitionStub,
} from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { type ActionDefinition, ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { AssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/AssaultEffectDefinition.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import { Ruleset, RulesetSchema } from "#shared/domain/ruleset/Ruleset.ts"

describe("Action Definition integrity", () => {
  it.each([
    {
      name: "missing before incompatible",
      tags: ["absent", "wrong", "absent"],
      messages: [
        'Action Definition "Schema Probe" is missing target slot tagged "absent" required by the "FLEET_BUILD" effect definition',
        'Action Definition "Schema Probe" target slot tagged "wrong" has type "FLEET", but the "FLEET_BUILD" effect definition requires "PLANET"',
        'Action Definition "Schema Probe" is missing target slot tagged "absent" required by the "FLEET_BUILD" effect definition',
      ],
    },
    {
      name: "incompatible before missing",
      tags: ["wrong", "absent", "absent"],
      messages: [
        'Action Definition "Schema Probe" target slot tagged "wrong" has type "FLEET", but the "FLEET_BUILD" effect definition requires "PLANET"',
        'Action Definition "Schema Probe" is missing target slot tagged "absent" required by the "FLEET_BUILD" effect definition',
        'Action Definition "Schema Probe" is missing target slot tagged "absent" required by the "FLEET_BUILD" effect definition',
      ],
    },
  ])("should preserve three full compatibility issues with $name", ({ tags, messages }) => {
    // Arrange
    const definition = createActionDefinitionStub({ id: "RENAMED" })
    const declaration: DeepUnbranded<ActionDefinition> = {
      ...definition,
      name: "Schema Probe",
      inputs: {},
      targets: { wrong: { targetType: "FLEET", constraints: [] }, site: { targetType: "PLANET", constraints: [] } },
      costs: [ResourceLossEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 1 })],
      effects: [
        ResourceGainEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 5 }),
        FleetBuildEffectDefinition.create({ planetTag: "site", strength: 1 }),
        ...tags.map((planetTag) => FleetBuildEffectDefinition.create({ planetTag, strength: 1 })),
      ],
    }
    const ruleset = { ...createRulesetStub(), actionDefinitions: { RENAMED: declaration } }
    const before = structuredClone(ruleset)
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    const loaded = RulesetSchema.safeParse(JSON.parse(JSON.stringify(ruleset)))
    const result = Ruleset.safeCreate(ruleset)
    // Assert
    Assert.isDefined(constructed.error)
    Assert.isDefined(loaded.error)
    expect(constructed.error.issues).toStrictEqual(messages.map((message) => ({ code: "custom", path: [], message })))
    expect(loaded.error.issues).toStrictEqual(
      messages.map((message) => ({ code: "custom", path: ["actionDefinitions", "RENAMED"], message })),
    )
    expect(result).toStrictEqual(Result.Failure(messages))
    expect(ruleset).toStrictEqual(before)
  })

  it("should load fixed mixed Build references without changing parsed values", () => {
    // Arrange
    const definition = createActionDefinitionStub({ id: "RENAMED" })
    const declaration: DeepUnbranded<ActionDefinition> = {
      ...definition,
      name: "Schema Probe",
      inputs: {},
      targets: { wrong: { targetType: "FLEET", constraints: [] }, site: { targetType: "PLANET", constraints: [] } },
      costs: [ResourceLossEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 1 })],
      effects: [
        ResourceGainEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 5 }),
        FleetBuildEffectDefinition.create({ planetTag: "site", strength: 1 }),
        FleetBuildEffectDefinition.create({ planetTag: "site", strength: 2 }),
        FleetBuildEffectDefinition.create({ planetTag: "site", strength: 3 }),
        FleetBuildEffectDefinition.create({ planetTag: "site", strength: 4 }),
      ],
    }
    const ruleset = { ...createRulesetStub(), actionDefinitions: { RENAMED: declaration } }
    const before = structuredClone(ruleset)
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    const loaded = RulesetSchema.safeParse(JSON.parse(JSON.stringify(ruleset)))
    const result = Ruleset.safeCreate(ruleset)
    // Assert
    expect(constructed).toStrictEqual({ success: true, data: declaration })
    expect(loaded).toStrictEqual({ success: true, data: ruleset })
    expect(result).toStrictEqual(Result.Success(ruleset))
    expect(ruleset).toStrictEqual(before)
  })

  it("should retain nineteen role and composition issues at the declaration boundary", () => {
    // Arrange
    const definition = createActionDefinitionStub({ id: "RENAMED" })
    const move = FleetMoveEffectDefinition.create({ fleetTag: "absent", planetTag: "wrong", strengthTag: "force", speed: 2 })
    const declaration: DeepUnbranded<ActionDefinition> = {
      ...definition,
      name: "Schema Probe",
      costs: [],
      targets: { wrong: { targetType: "FLEET", constraints: [] }, site: { targetType: "PLANET", constraints: [] } },
      inputs: { force: { type: "FLEET_STRENGTH", fleetTargetTag: "site" }, spare: { type: "FLEET_STRENGTH", fleetTargetTag: "absent" } },
      effects: [AssaultEffectDefinition.create({ fleetTag: "absent", planetTag: "wrong" }), move, move],
    }
    const messages = [
      'Action Definition "Schema Probe" is missing target slot tagged "absent" required by the "ASSAULT" effect definition',
      'Action Definition "Schema Probe" target slot tagged "wrong" has type "FLEET", but the "ASSAULT" effect definition requires "PLANET"',
      'Action Definition "Schema Probe" is missing target slot tagged "absent" required by the "FLEET_MOVE" effect definition',
      'Action Definition "Schema Probe" target slot tagged "wrong" has type "FLEET", but the "FLEET_MOVE" effect definition requires "PLANET"',
      'Action Definition "Schema Probe" is missing target slot tagged "absent" required by the "FLEET_MOVE" effect definition',
      'Action Definition "Schema Probe" target slot tagged "wrong" has type "FLEET", but the "FLEET_MOVE" effect definition requires "PLANET"',
      "Assault must share the source and destination of exactly one Move",
      "An Action supports at most one FLEET_MOVE",
      "Input force references a missing or non-fleet source",
      "Input spare references a missing or non-fleet source",
      "Unused input spare",
      "Movement strength input must reference its fleet source",
      "Movement source must be owned",
      "Movement source must be stationary",
      "Movement destination must declare a range from its source",
      "Movement strength input must reference its fleet source",
      "Movement source must be owned",
      "Movement source must be stationary",
      "Movement destination must declare a range from its source",
    ]
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    // Assert
    Assert.isDefined(constructed.error)
    expect(constructed.error.issues).toStrictEqual(messages.map((message) => ({ code: "custom", path: [], message })))
  })

  it.each([
    { name: "empty", constraints: [], messages: ["Movement source must be owned", "Movement source must be stationary"] },
    {
      name: "duplicate stationary",
      constraints: [{ type: "STATIONARY_FLEET" }, { type: "STATIONARY_FLEET" }],
      messages: ["Movement source must be owned"],
    },
    {
      name: "duplicate owned",
      constraints: [
        { type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} },
        { type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} },
      ],
      messages: ["Movement source must be stationary"],
    },
  ])("should preserve ordered source-policy diagnostics for $name constraints", ({ constraints, messages }) => {
    // Arrange
    const definition = createFleetMoveActionDefinitionStub()
    const declaration = { ...definition, targets: { ...definition.targets, craft: { targetType: "FLEET", constraints } } }
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    // Assert
    expect(constructed.success).toBe(false)
    Assert.isDefined(constructed.error)
    expect(constructed.error.issues).toStrictEqual(messages.map((message) => ({ code: "custom", path: [], message })))
  })

  it("should preserve the full missing-source diagnostic vector", () => {
    // Arrange
    const definition = createFleetMoveActionDefinitionStub()
    const declaration = { ...definition, targets: { route: definition.targets[branded<TargetTag>("route")] } }
    const messages = [
      'Action Definition "Traverse" is missing target slot tagged "craft" required by the "FLEET_MOVE" effect definition',
      "Target route references a missing or non-fleet source",
      "Input force references a missing or non-fleet source",
      "Movement source must be owned",
      "Movement source must be stationary",
    ]
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    // Assert
    expect(constructed.success).toBe(false)
    Assert.isDefined(constructed.error)
    expect(constructed.error.issues).toStrictEqual(messages.map((message) => ({ code: "custom", path: [], message })))
  })

  it("should accept renamed movement declarations with reversed source policies", () => {
    // Arrange
    const definition = createFleetMoveActionDefinitionStub()
    const declaration = {
      ...definition,
      targets: {
        ...definition.targets,
        craft: {
          targetType: "FLEET",
          constraints: [{ type: "STATIONARY_FLEET" }, { type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} }],
        },
      },
    }
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    // Assert
    expect(constructed.success).toBe(true)
  })

  it("should reject invalid movement declarations", () => {
    // Arrange
    const definition = createFleetMoveActionDefinitionStub()
    const variants = [
      { ...definition, inputs: { force: { type: "FLEET_STRENGTH", fleetTargetTag: "route" } } },
      { ...definition, inputs: { force: { type: "FLEET_STRENGTH", fleetTargetTag: "absent" } } },
      { ...definition, targets: { ...definition.targets, craft: { targetType: "FLEET", constraints: [{ type: "STATIONARY_FLEET" }] } } },
      {
        ...definition,
        targets: {
          ...definition.targets,
          craft: { targetType: "FLEET", constraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} }] },
        },
      },
      { ...definition, targets: { ...definition.targets, route: { targetType: "PLANET", constraints: [] } } },
      { ...definition, targets: { ...definition.targets, route: { targetType: "PLANET", constraints: [{ type: "STATIONARY_FLEET" }] } } },
      {
        ...definition,
        targets: {
          ...definition.targets,
          craft: { targetType: "FLEET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance: 5 }] },
        },
      },
      { ...definition, targets: { ...definition.targets, route: { targetType: "PLANET", constraints: [{ type: "UNKNOWN_CONSTRAINT" }] } } },
      { ...definition, effects: [{ ...definition.effects[0], inputs: { strength: { actionInputTag: "absent" } } }] },
    ]
    // Act
    const constructed = variants.map((value) => ActionDefinitionSchema.safeParse(value).success)
    // Assert
    expect(constructed).toStrictEqual([false, false, false, false, false, false, false, false, false])
  })

  it("should rejects malformed declarative movement compositions", () => {
    // Arrange
    const definition = createFleetMoveActionDefinitionStub()
    const variants = [
      { ...definition, inputs: {} },
      { ...definition, inputs: { ...definition.inputs, unused: { type: "FLEET_STRENGTH", fleetTargetTag: "craft" } } },
      {
        ...definition,
        targets: {
          ...definition.targets,
          route: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "route", maximumDistance: 5 }] },
        },
      },
      ...[0, -1, Infinity].map((speed) => ({
        ...definition,
        effects: definition.effects.map((effect) => ({ ...effect, parameters: { speed } })),
      })),
      ...[0, -1, Infinity].map((maximumDistance) => ({
        ...definition,
        targets: {
          ...definition.targets,
          route: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance }] },
        },
      })),
    ]
    // Act
    const results = variants.map((value) => ActionDefinitionSchema.safeParse(value).success)
    // Assert
    expect(results).toStrictEqual(variants.map(() => false))
  })
})
