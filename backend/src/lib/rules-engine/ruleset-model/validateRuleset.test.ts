import { describe, expect, it } from "vitest"
import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"
import { CostMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/CostMechanic.ts"
import { IncomeMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/IncomeMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { validateRuleset } from "#lib/rules-engine/ruleset-model/validateRuleset.ts"

const validActionDefinition: ActionDefinition = {
  id: "TEST_ACTION",
  name: "Test Action",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  targets: {
    self: "",
  },
  costs: [
    CostMechanic.create({
      quantity: 2,
      resourceType: ResourceType.MONEY,
    }),
  ],
  mechanics: [
    IncomeMechanic.create({
      quantity: 5,
      resourceType: ResourceType.MONEY,
    }),
  ],
}

describe("validateRuleset", () => {
  it("should validate a Ruleset with correctly indexed Action Definitions and all required target slots", () => {
    // Arrange
    const ruleset: Ruleset = {
      actionDefinitions: {
        [validActionDefinition.id]: validActionDefinition,
      },
    }

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toEqual([])
  })

  it("should report an Action Definition indexed under an id other than its own", () => {
    // Arrange
    const ruleset: Ruleset = {
      actionDefinitions: {
        "incorrect-index": validActionDefinition,
      },
    }

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toEqual<typeof validationIssues>([
      {
        issue: "Action Definition Test Action is indexed under incorrect-index instead of TEST_ACTION",
      },
    ])
  })

  it("should report target slots required by costs and Mechanics but missing from the Action Definition", () => {
    // Arrange
    const actionDefinitionWithoutSelfTarget: ActionDefinition = {
      id: "MAKE_MORE_MONEY",
      name: "Make More Money",
      type: ActionType.DIRECTIVE,
      tier: ActionTier.STANDARD,
      // @ts-expect-error -- We don't have other targets than self right now, have to cheat
      targets: {},
      costs: [
        CostMechanic.create({
          quantity: 2,
          resourceType: ResourceType.MONEY,
        }),
      ],
      mechanics: [
        IncomeMechanic.create({
          quantity: 5,
          resourceType: ResourceType.MONEY,
        }),
      ],
    }
    const ruleset: Ruleset = {
      actionDefinitions: {
        [actionDefinitionWithoutSelfTarget.id]: actionDefinitionWithoutSelfTarget,
      },
    }

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toEqual<typeof validationIssues>([
      {
        issue: "Action Definition Make More Money is missing target slot self required by COST",
      },
      {
        issue: "Action Definition Make More Money is missing target slot self required by INCOME",
      },
    ])
  })
})
