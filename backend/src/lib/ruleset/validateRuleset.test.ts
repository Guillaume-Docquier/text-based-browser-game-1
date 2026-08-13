import { describe, expect, it } from "vitest"
import type { ActionDefinition } from "#lib/rules-engine/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/actions/ActionType.ts"
import { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import { IncomeMechanic } from "#lib/rules-engine/mechanics/implementations/IncomeMechanic.ts"
import { ResourceType } from "#lib/rules-engine/mechanics/ResourceType.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"
import { validateRuleset } from "#lib/ruleset/validateRuleset.ts"

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
    const ruleset: Ruleset = {
      actionDefinitions: {
        [validActionDefinition.id]: validActionDefinition,
      },
    }

    const validationResult = validateRuleset(ruleset)

    expect(validationResult).toEqual<typeof validationResult>({
      valid: true,
      invalidIndices: [],
      missingTargets: [],
    })
  })

  it("should report an Action Definition indexed under an id other than its own", () => {
    const ruleset: Ruleset = {
      actionDefinitions: {
        "incorrect-index": validActionDefinition,
      },
    }

    const validationResult = validateRuleset(ruleset)

    expect(validationResult).toEqual<typeof validationResult>({
      valid: false,
      invalidIndices: [
        {
          actionDefinitionId: validActionDefinition.id,
          expectedIndex: validActionDefinition.id,
          actualIndex: "incorrect-index",
        },
      ],
      missingTargets: [],
    })
  })

  it("should report target slots required by costs and Mechanics but missing from the Action Definition", () => {
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

    const validationResult = validateRuleset(ruleset)

    expect(validationResult).toEqual<typeof validationResult>({
      valid: false,
      invalidIndices: [],
      missingTargets: [
        {
          actionDefinitionId: actionDefinitionWithoutSelfTarget.id,
          missingTargetSlot: "self",
          forMechanicType: "COST",
        },
        {
          actionDefinitionId: actionDefinitionWithoutSelfTarget.id,
          missingTargetSlot: "self",
          forMechanicType: "INCOME",
        },
      ],
    })
  })
})
