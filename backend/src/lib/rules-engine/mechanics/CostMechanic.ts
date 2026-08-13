import type { AbstractMechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import { MechanicTargetSelf } from "#lib/rules-engine/mechanics/MechanicTarget.ts"
import type { QuantityOfResource } from "#lib/rules-engine/mechanics/QuantityOfResource.ts"

export interface CostMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: "COST"
  readonly targets: {
    readonly player: MechanicTargetSelf
  }
}

export const CostMechanic = {
  type: "COST",
  create: ({ quantity, resourceType }: Omit<CostMechanic, "type" | "targets">): CostMechanic => ({
    type: CostMechanic.type,
    quantity,
    resourceType,
    targets: {
      player: MechanicTargetSelf,
    },
  }),
} as const
