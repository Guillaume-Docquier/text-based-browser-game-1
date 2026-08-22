import { describe, expect, it } from "vitest"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
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

describe("validateRuleset", () => {
  it("should validate a Ruleset with correctly indexed Action Definitions and all required target slots", () => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: {
        [validActionDefinition.id]: validActionDefinition,
      },
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toEqual([])
  })

  it("should report an Action Definition indexed under an id other than its own", () => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: {
        "incorrect-index": validActionDefinition,
      },
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toEqual<typeof validationIssues>([
      {
        issue: `Action Definition ${validActionDefinition.name} is indexed under incorrect-index instead of ${validActionDefinition.id}`,
      },
    ])
  })

  it("should report target slots required by costs and Mechanics but missing from the Action Definition", () => {
    // Arrange
    const actionDefinitionWithoutSelfTarget = createActionDefinitionStub({
      id: "NO_SELF_TARGET",
      name: "No Self Target",
      // @ts-expect-error -- We don't have other targets than self right now, have to cheat
      targets: {},
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
    const ruleset = createRulesetStub({
      name: "Test Ruleset",
      actionDefinitions: {
        [actionDefinitionWithoutSelfTarget.id]: actionDefinitionWithoutSelfTarget,
      },
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toEqual<typeof validationIssues>([
      {
        issue: `Action Definition ${actionDefinitionWithoutSelfTarget.name} is missing target slot self required by ${ResourceLossMechanic.type}`,
      },
      {
        issue: `Action Definition ${actionDefinitionWithoutSelfTarget.name} is missing target slot self required by ${ResourceGainMechanic.type}`,
      },
    ])
  })
})
