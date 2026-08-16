import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import { TargetDefinitionSelf } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

export interface VictoryMechanic extends AbstractMechanic {
  readonly type: "VICTORY"
  readonly targets: {
    readonly player: TargetDefinitionSelf
  }
}

export const VictoryMechanic = {
  type: "VICTORY",
  create: (): VictoryMechanic => ({
    type: VictoryMechanic.type,
    targets: {
      player: TargetDefinitionSelf,
    },
  }),
} as const
