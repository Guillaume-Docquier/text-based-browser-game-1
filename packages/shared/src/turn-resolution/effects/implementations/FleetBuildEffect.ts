import { branded, Range, Result, type Rng } from "@guillaume-docquier/tools-ts"
import { safeTypedParse, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import type { GameId } from "#shared/domain/games/GameId.ts"
import { NonNegativeSafeIntegerSchema } from "#shared/domain/NonNegativeSafeInteger.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { type FleetName, FleetNameSchema } from "#shared/domain/world/fleets/FleetName.ts"
import { isFleetPresentAtPlanet } from "#shared/domain/world/fleets/isFleetPresentAtPlanet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { resolveTargetId } from "#shared/turn-resolution/effects/resolveTargetId.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { TurnState } from "#shared/turn-resolution/TurnState.ts"

export class FleetBuildEffect extends Effect {
  private readonly effectDefinition: FleetBuildEffectDefinition
  private readonly targetPlanetId: PlanetId

  public constructor(
    id: number,
    effectDefinition: FleetBuildEffectDefinition,
    submittedAction: SubmittedAction,
    definitionOrdinal: number = id,
  ) {
    super(id, effectDefinition.type, submittedAction, definitionOrdinal)
    this.effectDefinition = effectDefinition
    this.targetPlanetId = resolveTargetId(this.submittedAction.selectedTargets, this.effectDefinition.targets.planet)
  }

  protected override doResolve(context: TurnContext): Result<Array<ReturnType<typeof EffectOutcome.Resolved>>, EffectError> {
    const planet = TurnState.getPlanet(context.turnState, this.targetPlanetId)
    if (planet === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Build target Planet "${this.targetPlanetId}" does not exist` }))
    }
    const existingFleets = Object.values(context.turnState.fleets).filter(
      (candidate) => candidate.ownerPlayerId === this.submittedAction.playerId && isFleetPresentAtPlanet(candidate, this.targetPlanetId),
    )
    if (existingFleets.length > 1) {
      return Result.Failure(EffectError.Failed({ error: `Multiple friendly Fleets exist at Build target Planet "${this.targetPlanetId}"` }))
    }
    const existingFleet = existingFleets[0]
    if (existingFleet === undefined) {
      return this.build(context)
    }
    return this.reinforce(existingFleet)
  }

  private build(context: TurnContext): Result<Array<ReturnType<typeof EffectOutcome.Resolved>>, EffectError> {
    const fleetId = newFleetId({
      gameId: context.turnState.gameId,
      playerId: this.submittedAction.playerId,
      planetId: this.targetPlanetId,
      turn: context.turnState.turn,
    })
    if (Object.hasOwn(context.turnState.fleets, fleetId)) {
      return Result.Failure(EffectError.Failed({ error: `Deterministic Build Fleet "${fleetId}" already exists` }))
    }
    const nameResult = generateFleetName(context.rng)
    if (Result.isFailure(nameResult)) {
      return nameResult
    }
    const name = nameResult.value
    context.turnState.fleets[fleetId] = {
      id: fleetId,
      ownerPlayerId: this.submittedAction.playerId,
      name,
      strength: typedParse(NonNegativeSafeIntegerSchema, this.effectDefinition.parameters.strength),
      originPlanetId: this.targetPlanetId,
    }

    return Result.Success([
      EffectOutcome.Resolved({
        result: `Player "${this.submittedAction.playerId}" built Fleet "${fleetId}" with strength ${this.effectDefinition.parameters.strength} on Planet "${this.targetPlanetId}"`,
      }),
    ])
  }

  private reinforce(fleet: ResolutionFleet): Result<Array<ReturnType<typeof EffectOutcome.Resolved>>, EffectError> {
    if (!Number.isSafeInteger(fleet.strength) || fleet.strength < 0) {
      return Result.Failure(EffectError.Failed({ error: `Fleet "${fleet.id}" has an unsafe Strength value` }))
    }
    const reinforcedStrength = BigInt(fleet.strength) + BigInt(this.effectDefinition.parameters.strength)
    if (reinforcedStrength > BigInt(Number.MAX_SAFE_INTEGER)) {
      return Result.Failure(EffectError.Failed({ error: `Fleet "${fleet.id}" reinforcement exceeds the safe Strength range` }))
    }
    fleet.strength = typedParse(NonNegativeSafeIntegerSchema, Number(reinforcedStrength))
    return Result.Success([
      EffectOutcome.Resolved({
        result: `Player "${this.submittedAction.playerId}" reinforced Fleet "${fleet.id}" by ${this.effectDefinition.parameters.strength} on Planet "${this.targetPlanetId}"`,
      }),
    ])
  }
}

const FLEET_NAME_NUMBER_RANGE = Range.integer({ min: 999, max: 999999 })

/**
 * Assigns Fleet names from the canonical Build effect order.
 */
function generateFleetName(rng: Rng): Result<FleetName, EffectError> {
  const parsedName = safeTypedParse(FleetNameSchema, `fleet ${rng.int(FLEET_NAME_NUMBER_RANGE)}`)
  return parsedName.success
    ? Result.Success(parsedName.data)
    : Result.Failure(EffectError.Failed({ error: "Generated Fleet name was invalid" }))
}

/**
 * Creates a deterministic identity unique to a game, player, Planet, and turn.
 */
function newFleetId({
  gameId,
  playerId,
  planetId,
  turn,
}: {
  gameId: GameId
  playerId: PlayerId
  planetId: PlanetId
  turn: number
}): FleetId {
  return branded<FleetId>(v5(`${gameId}-${playerId}-${planetId}-${turn}`, "429f862a-013d-5dc6-8d9b-f4fe00801af1"))
}
