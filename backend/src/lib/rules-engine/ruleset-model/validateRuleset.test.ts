import { branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { indexById } from "#lib/indexById.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset-model/Ruleset.stub.ts"
import { validateRuleset } from "#lib/rules-engine/ruleset-model/validateRuleset.ts"

const validActionDefinition = createActionDefinitionStub({
  id: "VALID_ACTION",
  name: "Valid Action",
  costs: [
    ResourceLossMechanic.create({
      quantity: branded(2),
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
  mechanics: [
    ResourceGainMechanic.create({
      quantity: branded(5),
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
})

describe("validateRuleset", () => {
  it("should validate a Ruleset with correctly indexed Action Definitions and all required target slots", () => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([validActionDefinition]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual([])
  })

  it("should report an Action Definition indexed under an id other than its own", () => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: { "incorrect-index": validActionDefinition },
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual<typeof validationIssues>([
      {
        issue: `Action Definition ${validActionDefinition.name} is indexed under incorrect-index instead of ${validActionDefinition.id}`,
      },
    ])
  })

  it.each([0, -1])("should report a non-positive fleet strength", (strength) => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([
        createActionDefinitionStub({
          targets: {
            planet: "",
          },
          mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: branded(strength) })], // intentionally using `branded` instead of `brand` for this test
        }),
      ]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual<typeof validationIssues>([
      { issue: expect.stringContaining("Too small: expected number to be >0") },
    ])
    expect(validationIssues).toStrictEqual<typeof validationIssues>([
      { issue: expect.stringContaining("at actionDefinitions.TEST_ACTION.mechanics[0].parameters.strength") },
    ])
  })
})
