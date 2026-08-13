import type { AbstractMechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import { MechanicTargetSelf } from "#lib/rules-engine/mechanics/MechanicTarget.ts"
import type { QuantityOfResource } from "#lib/rules-engine/mechanics/QuantityOfResource.ts"

export interface IncomeMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: "INCOME"
  readonly targets: {
    readonly player: MechanicTargetSelf
  }
}

export const IncomeMechanic = {
  type: "INCOME",
  create: ({ quantity, resourceType }: Omit<IncomeMechanic, "type" | "targets">): IncomeMechanic => ({
    type: IncomeMechanic.type,
    quantity,
    resourceType,
    targets: {
      player: MechanicTargetSelf,
    },
  }),
} as const
