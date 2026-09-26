import { branded, indexBy, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.stub.ts"
import type { TargetTag } from "#lib/rules-engine/ruleset/action-definitions/TargetTag.ts"
import { FleetBuildMechanic } from "#lib/rules-engine/ruleset/effect-definitions/implementations/FleetBuildMechanic.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/effect-definitions/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset/effect-definitions/TargetType.ts"
import { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import type { Integer } from "#lib/validation/Integer.ts"
import type { PositiveNumber } from "#lib/validation/PositiveNumber.ts"

const startingResources = {
  [ResourceType.INFLUENCE]: 0,
  [ResourceType.METAL]: 0,
  [ResourceType.FUEL]: 0,
  [ResourceType.ENERGY]: 0,
  [ResourceType.COLONY]: 0,
}

const validActionDefinition = createActionDefinitionStub({
  id: "VALID_ACTION",
  name: "Valid Action",
  costs: [
    ResourceLossMechanic.create({
      quantity: 2,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
  mechanics: [
    ResourceGainMechanic.create({
      quantity: 5,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
})

describe("Ruleset.safeCreate", () => {
  it("should validate a Ruleset with correctly indexed Action Definitions and all required target slots", () => {
    // Arrange
    const ruleset = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [validActionDefinition]),
      startingResources,
    } satisfies Parameters<typeof Ruleset.safeCreate>[0]

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Success(ruleset))
  })

  it("should report an Action Definition indexed under an id other than its own", () => {
    // Arrange
    const ruleset = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: { "incorrect-index": validActionDefinition },
      startingResources,
    } satisfies Parameters<typeof Ruleset.safeCreate>[0]

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition ${validActionDefinition.name} is indexed under incorrect-index instead of ${validActionDefinition.id}`,
      ]),
    )
  })

  it("should report a target slot required by a Mechanic but missing from its Action Definition", () => {
    // Arrange
    const actionDefinition = {
      ...validActionDefinition,
      mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
    }
    const ruleset = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [actionDefinition]),
      startingResources,
    } satisfies Parameters<typeof Ruleset.safeCreate>[0]

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition "${actionDefinition.name}" is missing target slot tagged "planet" required by the "${FleetBuildMechanic.type}" mechanic`,
      ]),
    )
  })

  it("should report an Action Definition target slot with an incompatible type", () => {
    // Arrange
    const actionDefinition = {
      ...validActionDefinition,
      targets: { planet: { targetType: TargetType.FLEET, constraints: [] } },
      mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
    }
    const ruleset = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [actionDefinition]),
      startingResources,
    } satisfies Parameters<typeof Ruleset.safeCreate>[0]

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition "${actionDefinition.name}" target slot tagged "planet" has type "FLEET", but the "FLEET_BUILD" mechanic requires "PLANET"`,
      ]),
    )
  })

  it.each([0, -1])("should report a non-positive fleet strength", (strength) => {
    // Arrange
    const actionDefinition = {
      ...validActionDefinition,
      id: "TEST_ACTION",
      targets: {
        [branded<TargetTag>("planet")]: { targetType: TargetType.PLANET, constraints: [] },
      },
      mechanics: [
        {
          type: FleetBuildMechanic.type,
          targets: {
            planet: {
              actionTargetTag: branded("planet"),
              targetType: TargetType.PLANET,
            },
          },
          parameters: {
            // Keep the invalid value intact so Ruleset.safeCreate can validate it.
            strength: branded<PositiveNumber & Integer>(strength),
          },
        },
      ],
    } satisfies typeof validActionDefinition
    const ruleset = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [actionDefinition]),
      startingResources,
    } satisfies Parameters<typeof Ruleset.safeCreate>[0]

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Failure([expect.stringContaining("Too small: expected number to be >0")]))
    expect(result).toStrictEqual(
      Result.Failure([expect.stringContaining("at actionDefinitions.TEST_ACTION.mechanics[0].parameters.strength")]),
    )
  })
})
