import { Result } from "@guillaume-docquier/tools-ts"
import { safeTypedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { compareCodePoints } from "#shared/domain/turns/actions/ActionResolutionOrigin.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { FleetStrengthSchema } from "#shared/domain/world/fleets/FleetStrength.ts"
import type { ArrivalIntent } from "#shared/turn-resolution/ArrivalIntent.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

/** One simultaneous snapshot exchange against every stationed opponent. */
export class AssaultEffect extends Effect {
  private readonly intent: ArrivalIntent | undefined
  public constructor(id: number, action: SubmittedAction, intent?: ArrivalIntent) {
    super(id, "ASSAULT", action)
    this.intent = intent
    this.origin = intent?.origin
  }
  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    const intent = this.intent
    if (intent === undefined) return Result.Failure(EffectError.Failed({ error: "Assault requires an arrival intent" }))
    if (context.destroyedFleetIds.has(intent.actualFleetId))
      return Result.Success([EffectOutcome.Prevented({ reason: "Attacking fleet was destroyed before this Assault" })])
    const attacker = context.turnState.fleets[intent.actualFleetId]
    if (
      attacker === undefined ||
      attacker.strength <= 0 ||
      attacker.ownerPlayerId !== this.submittedAction.playerId ||
      attacker.destinationPlanetId !== undefined ||
      attacker.originPlanetId !== intent.destinationPlanetId ||
      context.turnState.planets[intent.destinationPlanetId] === undefined
    )
      return Result.Failure(EffectError.Failed({ error: "Invalid Assault arrival binding" }))
    const defenders = Object.values(context.turnState.fleets)
      .filter(
        (fleet) =>
          fleet.strength > 0 &&
          fleet.ownerPlayerId !== attacker.ownerPlayerId &&
          fleet.originPlanetId === intent.destinationPlanetId &&
          fleet.destinationPlanetId === undefined,
      )
      .toSorted((a, b) => compareCodePoints(a.id, b.id))
    if ([attacker, ...defenders].some((fleet) => !safeTypedParse(FleetStrengthSchema, fleet.strength).success))
      return Result.Failure(EffectError.Failed({ error: "Invalid combat Strength" }))
    const a = BigInt(attacker.strength)
    const d = defenders.reduce((total, fleet) => total + BigInt(fleet.strength), 0n)
    const loss = a < d ? a : d
    const allocations = defenders.map((fleet) => {
      const product = loss * BigInt(fleet.strength)
      return { fleet, loss: product / d, remainder: product % d }
    })
    let remaining = loss - allocations.reduce((total, item) => total + item.loss, 0n)
    allocations.sort((left, right) =>
      left.remainder > right.remainder ? -1 : left.remainder < right.remainder ? 1 : compareCodePoints(left.fleet.id, right.fleet.id),
    )
    for (const item of allocations) {
      if (remaining === 0n) break
      item.loss += 1n
      remaining -= 1n
    }
    attacker.strength -= Number(loss)
    for (const item of allocations) item.fleet.strength -= Number(item.loss)
    for (const fleet of [attacker, ...defenders])
      if (fleet.strength === 0) {
        context.destroyedFleetIds.add(fleet.id)
        Reflect.deleteProperty(context.turnState.fleets, fleet.id)
      }
    return Result.Success([
      EffectOutcome.Resolved({
        result: `Assault at Planet "${intent.destinationPlanetId}" exchanged ${loss} Strength against ${d} defending Strength`,
      }),
    ])
  }
}
