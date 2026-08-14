import type { AbstractMechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import { MechanicTargetSelf, type PlayerMechanicTarget } from "#lib/rules-engine/mechanics/MechanicTarget.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"
import type { QuantityOfResource } from "#lib/rules-engine/mechanics/QuantityOfResource.ts"

export interface IncomeMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: typeof MechanicType.INCOME
  readonly targets: {
    readonly player: PlayerMechanicTarget
  }
}

export const IncomeMechanic = {
  create: ({
    quantity,
    resourceType,
    player = MechanicTargetSelf,
  }: Omit<IncomeMechanic, "type" | "targets"> & {
    readonly player?: PlayerMechanicTarget
  }): IncomeMechanic => ({
    type: MechanicType.INCOME,
    quantity,
    resourceType,
    targets: {
      player,
    },
  }),
} as const
