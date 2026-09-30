import { Assert } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#game-rules/action-submission/Action.ts"
import type { EffectDefinition } from "#game-rules/ruleset/effect-definitions/EffectDefinition.ts"
import { FleetBuildEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/FleetBuildEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/FleetMoveEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { VictoryEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/VictoryEffectDefinition.ts"
import type { Ruleset } from "#game-rules/ruleset/Ruleset.ts"
import type { Effect } from "#game-rules/turn-resolution/effects/Effect.ts"
import { FleetBuildEffect } from "#game-rules/turn-resolution/effects/implementations/FleetBuildEffect.ts"
import { FleetMoveEffect } from "#game-rules/turn-resolution/effects/implementations/FleetMoveEffect.ts"
import { ResourceGainEffect } from "#game-rules/turn-resolution/effects/implementations/ResourceGainEffect.ts"
import { ResourceLossEffect } from "#game-rules/turn-resolution/effects/implementations/ResourceLossEffect.ts"
import { VictoryEffect } from "#game-rules/turn-resolution/effects/implementations/VictoryEffect.ts"
import type { MonotonicIdFactory } from "#game-rules/turn-resolution/MonotonicIdFactory.ts"

export const EffectFactory = {
  /**
   * Creates all effects for an action submission
   */
  fromSubmittedAction: (submittedAction: SubmittedAction, ruleset: Ruleset, monotonicIdFactory: MonotonicIdFactory): Effect[] => {
    const actionDefinition = ruleset.actionDefinitions[submittedAction.actionDefinitionId]
    Assert.isDefined(actionDefinition)

    const effectDefinitions = [...actionDefinition.costs, ...actionDefinition.effects]

    return effectDefinitions.map((effectDefinition) =>
      EffectFactory.fromEffectDefinition(monotonicIdFactory(), effectDefinition, submittedAction),
    )
  },
  /**
   * Creates an effect from an effect definition.
   */
  fromEffectDefinition: (id: number, effectDefinition: EffectDefinition, submittedAction: SubmittedAction): Effect => {
    switch (effectDefinition.type) {
      case ResourceLossEffectDefinition.type:
        return new ResourceLossEffect(id, effectDefinition, submittedAction)
      case ResourceGainEffectDefinition.type:
        return new ResourceGainEffect(id, effectDefinition, submittedAction)
      case VictoryEffectDefinition.type:
        return new VictoryEffect(id, effectDefinition, submittedAction)
      case FleetBuildEffectDefinition.type:
        return new FleetBuildEffect(id, effectDefinition, submittedAction)
      case FleetMoveEffectDefinition.type:
        return new FleetMoveEffect(id, effectDefinition, submittedAction)
    }
  },
}
