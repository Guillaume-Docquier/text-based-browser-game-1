import type { AbstractMechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import type { QuantityOfResource } from "#lib/rules-engine/mechanics/QuantityOfResource.ts"
import { TargetDefinitionSelf } from "#lib/rules-engine/mechanics/TargetDefinition.ts"

export interface IncomeMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: "INCOME"
  readonly targets: {
    readonly player: TargetDefinitionSelf
  }
}

export const IncomeMechanic = {
  type: "INCOME",
  create: ({ quantity, resourceType }: Omit<IncomeMechanic, "type" | "targets">): IncomeMechanic => ({
    type: IncomeMechanic.type,
    quantity,
    resourceType,
    targets: {
      player: TargetDefinitionSelf,
    },
  }),
} as const
