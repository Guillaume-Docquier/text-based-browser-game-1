import { Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { NonNegativeSafeIntegerSchema } from "#shared/domain/NonNegativeSafeInteger.ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { VictoryEffectDefinition } from "#shared/domain/ruleset/effect-definitions/VictoryEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { PendingArrivalAssault } from "#shared/domain/world/fleets/Fleet.ts"
import type { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { FleetAssaultEffect } from "#shared/turn-resolution/effects/implementations/FleetAssaultEffect.ts"
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
  fromSubmittedAction: (
    submittedAction: SubmittedAction,
    ruleset: Ruleset,
    monotonicIdFactory: MonotonicIdFactory,
  ): Result<Effect[], EffectError> => {
    const actionDefinitionId = submittedAction.actionDefinitionId
    if (!Object.hasOwn(ruleset.actionDefinitions, actionDefinitionId) || ruleset.actionDefinitions[actionDefinitionId] === undefined) {
      return Result.Failure(EffectError.Failed({ error: 'Action Definition "' + actionDefinitionId + '" is missing from the Ruleset' }))
    }

    const actionDefinition = ruleset.actionDefinitions[actionDefinitionId]
    const effectDefinitions = [...actionDefinition.costs, ...actionDefinition.effects]
    const pendingArrivalEffects = effectDefinitions.flatMap((effectDefinition, definitionOrdinal) =>
      effectDefinition.type === FleetAssaultEffectDefinition.type
        ? [{ effectDefinition, definitionOrdinal: typedParse(NonNegativeSafeIntegerSchema, definitionOrdinal) }]
        : [],
    )

    return Result.Success(
      effectDefinitions.flatMap((effectDefinition, definitionOrdinal) => {
        if (isArrivalBoundAssault(effectDefinition, effectDefinitions)) {
          return []
        }
        return [
          EffectFactory.fromEffectDefinition(monotonicIdFactory(), effectDefinition, submittedAction, {
            definitionOrdinal,
            pendingArrivalEffects,
          }),
        ]
      }),
    )
  },
  /**
   * Creates an effect from an effect definition.
   */
  fromEffectDefinition: (
    id: number,
    effectDefinition: EffectDefinition,
    submittedAction: SubmittedAction,
    { definitionOrdinal, pendingArrivalEffects }: { definitionOrdinal: number; pendingArrivalEffects: readonly PendingArrivalAssault[] } = {
      definitionOrdinal: id,
      pendingArrivalEffects: [],
    },
  ): Effect => {
    switch (effectDefinition.type) {
      case ResourceLossEffectDefinition.type:
        return new ResourceLossEffect(id, effectDefinition, submittedAction)
      case ResourceGainEffectDefinition.type:
        return new ResourceGainEffect(id, effectDefinition, submittedAction)
      case VictoryEffectDefinition.type:
        return new VictoryEffect(id, effectDefinition, submittedAction)
      case FleetBuildEffectDefinition.type:
        return new FleetBuildEffect(id, effectDefinition, submittedAction, definitionOrdinal)
      case FleetMoveEffectDefinition.type:
        return new FleetMoveEffect(id, effectDefinition, submittedAction, pendingArrivalEffects, definitionOrdinal)
      case FleetAssaultEffectDefinition.type:
        return new FleetAssaultEffect(id, effectDefinition, submittedAction, definitionOrdinal)
    }
  },
}

function isArrivalBoundAssault(effectDefinition: EffectDefinition, effectDefinitions: readonly EffectDefinition[]): boolean {
  if (effectDefinition.type !== FleetAssaultEffectDefinition.type) {
    return false
  }
  return effectDefinitions.some(
    (candidate) =>
      candidate.type === FleetMoveEffectDefinition.type &&
      candidate.targets.fleet.actionTargetTag === effectDefinition.targets.fleet.actionTargetTag &&
      candidate.targets.planet.actionTargetTag === effectDefinition.targets.planet.actionTargetTag,
  )
}
