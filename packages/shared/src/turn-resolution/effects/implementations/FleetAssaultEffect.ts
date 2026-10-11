import { Result } from "@guillaume-docquier/tools-ts"
import type { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import type { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { resolveTargetId } from "#shared/turn-resolution/effects/resolveTargetId.ts"
import { resolveFleetAssaultAttempt } from "#shared/turn-resolution/phases/implementations/fleetAssault.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export class FleetAssaultEffect extends Effect {
  public readonly initiatingFleetId: FleetId
  public readonly targetPlanetId: PlanetId

  public constructor(
    id: number,
    effectDefinition: FleetAssaultEffectDefinition,
    submittedAction: SubmittedAction,
    definitionOrdinal: number,
  ) {
    super(id, effectDefinition.type, submittedAction, definitionOrdinal)
    this.initiatingFleetId = resolveTargetId(submittedAction.selectedTargets, effectDefinition.targets.fleet)
    this.targetPlanetId = resolveTargetId(submittedAction.selectedTargets, effectDefinition.targets.planet)
  }

  /**
   * Resolves this order against the Fleet that survived prior arrival merges.
   */
  public resolveAgainstFleet(context: TurnContext, attackingFleetId: FleetId): Result<EffectOutcome[], EffectError> {
    const result = this.resolveForFleet(context, attackingFleetId)
    if (Result.isSuccess(result)) {
      context.effectPool.recordOutcomes(this, result.value)
    }
    return result
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    return this.resolveForFleet(context, this.initiatingFleetId)
  }

  private resolveForFleet(context: TurnContext, attackingFleetId: FleetId): Result<EffectOutcome[], EffectError> {
    const result = resolveFleetAssaultAttempt({
      context,
      submittingPlayerId: this.submittedAction.playerId,
      attackingFleetId,
      planetId: this.targetPlanetId,
    })
    return Result.isFailure(result) ? result : Result.Success([result.value])
  }
}
