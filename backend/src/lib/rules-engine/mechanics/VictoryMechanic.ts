import type { AbstractMechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import { MechanicTargetSelf } from "#lib/rules-engine/mechanics/MechanicTarget.ts"

export interface VictoryMechanic extends AbstractMechanic {
  readonly type: "VICTORY"
  readonly targets: {
    readonly player: MechanicTargetSelf
  }
}

export const VictoryMechanic = {
  type: "VICTORY",
  create: (): VictoryMechanic => ({
    type: VictoryMechanic.type,
    targets: {
      player: MechanicTargetSelf,
    },
  }),
} as const
