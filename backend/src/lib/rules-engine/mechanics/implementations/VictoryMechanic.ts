import type { AbstractMechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import { MechanicTargetSelf, type PlayerMechanicTarget } from "#lib/rules-engine/mechanics/MechanicTarget.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"

export interface VictoryMechanic extends AbstractMechanic {
  readonly type: typeof MechanicType.VICTORY
  readonly targets: {
    readonly player: PlayerMechanicTarget
  }
}

export const VictoryMechanic = {
  create: ({ player = MechanicTargetSelf }: { readonly player?: PlayerMechanicTarget } = {}): VictoryMechanic => ({
    type: MechanicType.VICTORY,
    targets: {
      player,
    },
  }),
} as const
