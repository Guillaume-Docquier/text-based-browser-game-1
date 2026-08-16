import type { ActionDefinition } from "#lib/rules-engine/ruleset/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/actions/ActionType.ts"
import { CostMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/CostMechanic.ts"
import { IncomeMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/IncomeMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/mechanics/ResourceType.ts"

export const MakeMoreMoney: ActionDefinition = {
  id: "MAKE_MORE_MONEY",
  name: "Make More Money",
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
