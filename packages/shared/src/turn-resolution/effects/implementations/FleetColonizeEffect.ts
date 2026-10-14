import { Result } from "@guillaume-docquier/tools-ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import type { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { resolveTargetId } from "#shared/turn-resolution/effects/resolveTargetId.ts"
import { resolveFleetColonizeAttempt } from "#shared/turn-resolution/phases/implementations/fleetColonize.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export class FleetColonizeEffect extends Effect {
  public readonly initiatingFleetId: FleetId
  public readonly targetPlanetId: PlanetId
  public readonly strengthRequirement: PositiveInteger

  public constructor(
    id: number,
    effectDefinition: FleetColonizeEffectDefinition,
    submittedAction: SubmittedAction,
    definitionOrdinal: number,
  ) {
    super(id, effectDefinition.type, submittedAction, definitionOrdinal)
    this.initiatingFleetId = resolveTargetId(submittedAction.selectedTargets, effectDefinition.targets.fleet)
    this.targetPlanetId = resolveTargetId(submittedAction.selectedTargets, effectDefinition.targets.planet)
    this.strengthRequirement = effectDefinition.parameters.strengthRequirement
  }

  public resolveAgainstFleet(context: TurnContext, fleetId: FleetId): Result<EffectOutcome[], EffectError> {
    const result = this.resolveForFleet(context, fleetId)
    if (Result.isSuccess(result)) {
      context.effectPool.recordOutcomes(this, result.value)
    }
    return result
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    return this.resolveForFleet(context, this.initiatingFleetId)
  }

  private resolveForFleet(context: TurnContext, fleetId: FleetId): Result<EffectOutcome[], EffectError> {
    const result = resolveFleetColonizeAttempt({
      context,
      submittingPlayerId: this.submittedAction.playerId,
      fleetId,
      planetId: this.targetPlanetId,
      strengthRequirement: this.strengthRequirement,
    })
    return Result.isFailure(result) ? result : Result.Success([result.value])
  }
}
