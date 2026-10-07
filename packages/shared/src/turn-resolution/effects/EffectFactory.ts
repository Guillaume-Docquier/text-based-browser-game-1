import { Assert } from "@guillaume-docquier/tools-ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { VictoryEffectDefinition } from "#shared/domain/ruleset/effect-definitions/VictoryEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { FleetBuildEffect } from "#shared/turn-resolution/effects/implementations/FleetBuildEffect.ts"
import { FleetMoveEffect } from "#shared/turn-resolution/effects/implementations/FleetMoveEffect.ts"
import { ResourceGainEffect } from "#shared/turn-resolution/effects/implementations/ResourceGainEffect.ts"
import { ResourceLossEffect } from "#shared/turn-resolution/effects/implementations/ResourceLossEffect.ts"
import { VictoryEffect } from "#shared/turn-resolution/effects/implementations/VictoryEffect.ts"
import type { MonotonicIdFactory } from "#shared/turn-resolution/MonotonicIdFactory.ts"

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
