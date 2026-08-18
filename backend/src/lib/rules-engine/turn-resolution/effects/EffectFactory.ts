import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { VictoryMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/VictoryMechanic.ts"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import { ResourceGainEffect } from "#lib/rules-engine/turn-resolution/effects/implementations/ResourceGainEffect.ts"
import { ResourceLossEffect } from "#lib/rules-engine/turn-resolution/effects/implementations/ResourceLossEffect.ts"
import { VictoryEffect } from "#lib/rules-engine/turn-resolution/effects/implementations/VictoryEffect.ts"
import type { MonotonicIdFactory } from "#lib/rules-engine/turn-resolution/MonotonicIdFactory.ts"

export const EffectFactory = {
  /**
   * Creates all effects for an action submission
   */
  fromActionSubmission: (actionSubmission: ActionSubmission, ruleset: Ruleset, monotonicIdFactory: MonotonicIdFactory): Effect[] => {
    const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
    Assert.isDefined(actionDefinition)

    const mechanics = [...actionDefinition.costs, ...actionDefinition.mechanics]

    return mechanics.map((mechanic) => EffectFactory.fromMechanic(monotonicIdFactory(), mechanic, actionSubmission))
  },
  /**
   * Creates an effect for a mechanic
   */
  fromMechanic: (id: number, mechanic: Mechanic, actionSubmission: ActionSubmission): Effect => {
    switch (mechanic.type) {
      case ResourceLossMechanic.type:
        return new ResourceLossEffect(id, mechanic, actionSubmission)
      case ResourceGainMechanic.type:
        return new ResourceGainEffect(id, mechanic, actionSubmission)
      case VictoryMechanic.type:
        return new VictoryEffect(id, mechanic, actionSubmission)
    }
  },
}
