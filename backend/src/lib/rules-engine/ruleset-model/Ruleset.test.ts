import { branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { indexById } from "#lib/indexById.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset-model/Ruleset.stub.ts"
import { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"

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
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([validActionDefinition]),
    })

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Success(ruleset))
  })

  it("should report an Action Definition indexed under an id other than its own", () => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: { "incorrect-index": validActionDefinition },
    })

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
    const actionDefinition = createActionDefinitionStub({
      mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([actionDefinition]),
    })

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition "${actionDefinition.name}" is missing target slot "planet" required by the "${FleetBuildMechanic.type}" mechanic`,
      ]),
    )
  })

  it("should report an Action Definition target slot with an incompatible type", () => {
    // Arrange
    const actionDefinition = createActionDefinitionStub({
      targets: { planet: { targetType: TargetType.FLEET, constraints: [] } },
      mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([actionDefinition]),
    })

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition "${actionDefinition.name}" target slot "planet" has type "FLEET", but the "FLEET_BUILD" mechanic requires "PLANET"`,
      ]),
    )
  })

  it.each([0, -1])("should report a non-positive fleet strength", (strength) => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([
        createActionDefinitionStub({
          targets: {
            planet: { targetType: TargetType.PLANET, constraints: [] },
          },
          mechanics: [
            {
              type: FleetBuildMechanic.type,
              targets: {
                planet: {
                  tag: "planet",
                  targetType: TargetType.PLANET,
                },
              },
              parameters: {
                // intentionally using `branded` and hand rolled json instead of the mechanic factory because the factory validates the payload
                // right now it makes no sense, but later on we'll parse raw json too
                strength: branded(strength),
              },
            },
          ],
        }),
      ]),
    })

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Failure([expect.stringContaining("Too small: expected number to be >0")]))
    expect(result).toStrictEqual(
      Result.Failure([expect.stringContaining("at actionDefinitions.TEST_ACTION.mechanics[0].parameters.strength")]),
    )
  })
})
