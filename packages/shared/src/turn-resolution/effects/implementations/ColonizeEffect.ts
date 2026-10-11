import { Result } from "@guillaume-docquier/tools-ts"
import { safeTypedParse } from "@guillaume-docquier/tools-ts/schemas"
import { evaluateColonization } from "#shared/action-submission/colonizationEligibility.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { FleetStrengthSchema } from "#shared/domain/world/fleets/FleetStrength.ts"
import type { ArrivalIntent } from "#shared/turn-resolution/ArrivalIntent.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

/** Binding integrity precedes the same eligibility predicate used by initial selections. */
export function evaluateColonizeIntent(context: TurnContext, intent: ArrivalIntent): Result<string[], EffectError> {
  const planet = context.turnState.planets[intent.destinationPlanetId]
  if (intent.pending.type !== "COLONIZE" || planet === undefined)
    return Result.Failure(EffectError.Failed({ error: "Invalid Colonize arrival definition or planet" }))
  if (context.destroyedFleetIds.has(intent.actualFleetId)) return Result.Success(["Colonizing fleet was destroyed before Colonization"])
  const fleet = context.turnState.fleets[intent.actualFleetId]
  if (
    fleet === undefined ||
    fleet.ownerPlayerId !== intent.origin.submittedAction.playerId ||
    fleet.destinationPlanetId !== undefined ||
    fleet.movement !== undefined ||
    fleet.originPlanetId !== planet.id ||
    !safeTypedParse(FleetStrengthSchema, fleet.strength).success ||
    fleet.strength <= 0
  )
    return Result.Failure(EffectError.Failed({ error: "Invalid Colonize arrival binding" }))
  return Result.Success(
    evaluateColonization({ definition: intent.pending.definition, ownerPlayerId: planet.ownerPlayerId, strength: fleet.strength }),
  )
}
/** Deferred fixed Strength consumption, on the current merged post-Combat survivor. */
export class ColonizeEffect extends Effect {
  private readonly intent: ArrivalIntent | undefined
  public constructor(id: number, action: SubmittedAction, intent?: ArrivalIntent) {
    super(id, "COLONIZE", action)
    this.intent = intent
    this.origin = intent?.origin
  }
  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    const intent = this.intent
    if (intent === undefined || intent.pending.type !== "COLONIZE")
      return Result.Failure(EffectError.Failed({ error: "Colonize requires an arrival intent" }))
    const eligibility = evaluateColonizeIntent(context, intent)
    if (Result.isFailure(eligibility)) return eligibility
    if (eligibility.value.length > 0) return Result.Success(eligibility.value.map((reason) => EffectOutcome.Prevented({ reason })))
    const fleet = context.turnState.fleets[intent.actualFleetId]
    const planet = context.turnState.planets[intent.destinationPlanetId]
    if (fleet === undefined || planet === undefined) return Result.Failure(EffectError.Failed({ error: "Missing Colonize survivor" }))
    context.turnState.planets[planet.id] = { ...planet, ownerPlayerId: this.submittedAction.playerId }
    fleet.strength -= intent.pending.definition.parameters.requiredStrength
    if (fleet.strength === 0) {
      context.destroyedFleetIds.add(fleet.id)
      Reflect.deleteProperty(context.turnState.fleets, fleet.id)
    }
    return Result.Success([
      EffectOutcome.Resolved({
        result: `Planet "${planet.name}" colonized, consuming ${intent.pending.definition.parameters.requiredStrength} Strength`,
      }),
    ])
  }
}
