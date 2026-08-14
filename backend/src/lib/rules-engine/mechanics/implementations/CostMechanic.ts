import type { AbstractMechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import { MechanicTargetSelf } from "#lib/rules-engine/mechanics/MechanicTarget.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"
import type { QuantityOfResource } from "#lib/rules-engine/mechanics/QuantityOfResource.ts"

export interface CostMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: typeof MechanicType.COST
  readonly targets: {
    readonly player: MechanicTargetSelf
  }
}

export const CostMechanic = {
  create: ({ quantity, resourceType }: Omit<CostMechanic, "type" | "targets">): CostMechanic => ({
    type: MechanicType.COST,
    quantity,
    resourceType,
    targets: {
      player: MechanicTargetSelf,
    },
  }),
} as const
