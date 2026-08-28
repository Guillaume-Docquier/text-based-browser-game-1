import { Assert } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
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
  fromSubmittedAction: (submittedAction: SubmittedAction, ruleset: Ruleset, monotonicIdFactory: MonotonicIdFactory): Effect[] => {
    const actionDefinition = ruleset.actionDefinitions[submittedAction.actionDefinitionId]
    Assert.isDefined(actionDefinition)

    const mechanics = [...actionDefinition.costs, ...actionDefinition.mechanics]

    return mechanics.map((mechanic) => EffectFactory.fromMechanic(monotonicIdFactory(), mechanic, submittedAction))
  },
  /**
   * Creates an effect for a mechanic
   */
  fromMechanic: (id: number, mechanic: Mechanic, submittedAction: SubmittedAction): Effect => {
    switch (mechanic.type) {
      case ResourceLossMechanic.type:
        return new ResourceLossEffect(id, mechanic, submittedAction)
      case ResourceGainMechanic.type:
        return new ResourceGainEffect(id, mechanic, submittedAction)
      case VictoryMechanic.type:
        return new VictoryEffect(id, mechanic, submittedAction)
    }
  },
}
