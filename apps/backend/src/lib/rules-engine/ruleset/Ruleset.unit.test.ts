import { type DeepUnbranded, indexBy, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.stub.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"
import { FleetBuildEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/FleetBuildEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset/effect-definitions/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/effect-definitions/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset/effect-definitions/TargetType.ts"
import { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"

const validActionDefinition = createActionDefinitionStub({
  id: "VALID_ACTION",
  name: "Valid Action",
  costs: [
    ResourceLossEffectDefinition.create({
      quantity: 2,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
  effects: [
    ResourceGainEffectDefinition.create({
      quantity: 5,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
})

describe("Ruleset.safeCreate", () => {
  it("should validate a Ruleset with correctly indexed Action Definitions and all required target slots", () => {
    // Arrange
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [validActionDefinition]),
      actionPool: [{ id: "VALID_ACTION_1", actionDefinitionId: validActionDefinition.id }],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Success(ruleset))
  })

  it("should report an Action Definition indexed under an id other than its own", () => {
    // Arrange
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: { "incorrect-index": validActionDefinition },
      actionPool: [],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition ${validActionDefinition.name} is indexed under incorrect-index instead of ${validActionDefinition.id}`,
      ]),
    )
  })

  it("should report a target slot required by a EffectDefinition but missing from its Action Definition", () => {
    // Arrange
    const actionDefinition: DeepUnbranded<ActionDefinition> = {
      ...validActionDefinition,
      effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 1 })],
    }
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [actionDefinition]),
      actionPool: [],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition "${actionDefinition.name}" is missing target slot tagged "planet" required by the "${FleetBuildEffectDefinition.type}" effect definition`,
      ]),
    )
  })

  it("should report an Action Definition target slot with an incompatible type", () => {
    // Arrange
    const actionDefinition: DeepUnbranded<ActionDefinition> = {
      ...validActionDefinition,
      targets: { planet: { targetType: TargetType.FLEET, constraints: [] } },
      effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 1 })],
    }
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [actionDefinition]),
      actionPool: [],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition "${actionDefinition.name}" target slot tagged "planet" has type "FLEET", but the "FLEET_BUILD" effect definition requires "PLANET"`,
      ]),
    )
  })

  it.each([0, -1])("should report a non-positive fleet strength", (invalidStrength) => {
    // Arrange
    const actionDefinition: DeepUnbranded<ActionDefinition> = {
      ...validActionDefinition,
      id: "TEST_ACTION",
      targets: {
        planet: { targetType: TargetType.PLANET, constraints: [] },
      },
      effects: [
        {
          type: FleetBuildEffectDefinition.type,
          targets: {
            planet: {
              actionTargetTag: "planet",
              targetType: TargetType.PLANET,
            },
          },
          parameters: {
            strength: invalidStrength,
          },
        },
      ],
    }
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [actionDefinition]),
      actionPool: [],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Failure([expect.stringContaining("Too small: expected number to be >0")]))
    expect(result).toStrictEqual(
      Result.Failure([expect.stringContaining("at actionDefinitions.TEST_ACTION.effects[0].parameters.strength")]),
    )
  })

  it("should reject an Action Pool entry that references a missing Action Definition", () => {
    // Arrange
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [validActionDefinition]),
      actionPool: [{ id: "MISSING_ACTION_1", actionDefinitionId: "MISSING_ACTION" }],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure(["Action Pool action MISSING_ACTION_1 references missing Action Definition MISSING_ACTION"]),
    )
  })

  it("should reject duplicate Action IDs in the Action Pool", () => {
    // Arrange
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [validActionDefinition]),
      actionPool: [
        { id: "VALID_ACTION_1", actionDefinitionId: validActionDefinition.id },
        { id: "VALID_ACTION_1", actionDefinitionId: validActionDefinition.id },
      ],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Failure(["Action Pool contains duplicate action id VALID_ACTION_1"]))
  })
})
