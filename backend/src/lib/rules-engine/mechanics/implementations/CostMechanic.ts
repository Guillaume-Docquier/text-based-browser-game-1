import type { AbstractMechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import type { QuantityOfResource } from "#lib/rules-engine/mechanics/QuantityOfResource.ts"
import { TargetDefinitionSelf } from "#lib/rules-engine/mechanics/TargetDefinition.ts"

export interface CostMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: "COST"
  readonly targets: {
    readonly player: TargetDefinitionSelf
  }
}

export const CostMechanic = {
  type: "COST",
  create: ({ quantity, resourceType }: Omit<CostMechanic, "type" | "targets">): CostMechanic => ({
    type: CostMechanic.type,
    quantity,
    resourceType,
    targets: {
      player: TargetDefinitionSelf,
    },
  }),
} as const
