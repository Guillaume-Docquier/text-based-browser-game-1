import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import type { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { Fleet, FleetMovement, PendingArrivalEffect } from "#shared/domain/world/fleets/Fleet.ts"
import { FleetIdSchema } from "#shared/domain/world/fleets/FleetId.ts"
import { type PlanetId, PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"
import {
  type EligibilityState,
  type MutableEvaluation,
  isFleetMoveEffectDefinition,
  getOwnRecordValue,
  addIssue,
  type EligibilityIssue,
} from "./selectionEvaluation.ts"

/** Checks persisted journeys and per-player occupancy before evaluating new proposals. */
export function validateMovementOccupancy({
  state,
  ruleset,
  evaluation,
}: {
  state: EligibilityState
  ruleset: Ruleset
  evaluation: MutableEvaluation
}): void {
  const occupancy = new Map<ActionId, Fleet[]>()
  for (const fleet of Object.values(state.fleets).toSorted((a, b) => compareOrdinalStrings(a.id, b.id))) {
    const issue = journeyIssue(fleet, state, ruleset)
    if (issue !== undefined) {
      addIssue(evaluation, issue)
    }
    if (!hasCompleteJourney(fleet) || fleet.ownerPlayerId !== state.submittingPlayerId) {
      continue
    }
    occupancy.set(fleet.movement.submission.id, [...(occupancy.get(fleet.movement.submission.id) ?? []), fleet])
  }
  for (const [actionId, fleets] of occupancy) {
    if (fleets.length > 1) {
      addIssue(evaluation, {
        code: "DUPLICATE_ACTION_OCCUPANCY",
        actionId,
        message: `More than one in-transit Fleet occupies Action instance "${actionId}"`,
      })
    }
  }
}
function hasCompleteJourney(
  fleet: Fleet,
): fleet is Fleet & { movement: FleetMovement; destinationPlanetId: PlanetId; distanceToEnd: number } {
  return fleet.destinationPlanetId !== undefined && fleet.distanceToEnd !== undefined && fleet.movement !== undefined
}
function journeyIssue(fleet: Fleet, state: EligibilityState, ruleset: Ruleset): EligibilityIssue | undefined {
  if (fleet.destinationPlanetId === undefined && fleet.distanceToEnd === undefined && fleet.movement === undefined) {
    return undefined
  }
  if (!hasCompleteJourney(fleet)) {
    return {
      code: "INVALID_MOVEMENT_BINDING",
      ...(fleet.movement === undefined ? {} : { actionId: fleet.movement.submission.id }),
      message: `Fleet "${fleet.id}" has incomplete in-progress movement data`,
    }
  }
  if (isValidBinding(fleet, state, ruleset)) {
    return undefined
  }
  return {
    code: "INVALID_MOVEMENT_BINDING",
    actionId: fleet.movement.submission.id,
    message: "Fleet " + fleet.id + " has an invalid in-progress Action binding",
  }
}
function isValidBinding(
  fleet: Fleet & { movement: FleetMovement; destinationPlanetId: PlanetId },
  state: EligibilityState,
  ruleset: Ruleset,
): boolean {
  const movement = fleet.movement
  const bound = boundMovementDefinition(movement, ruleset)
  if (bound === undefined) {
    return false
  }
  const { definition, move } = bound
  if (fleet.ownerPlayerId !== movement.submission.playerId || movement.departureTurn > state.turn) {
    return false
  }
  return (
    selectionsMatchDefinition(definition, movement) &&
    matchesMovementTargets(fleet, state, definition, move) &&
    matchesArrivalEffects(definition, move, movement)
  )
}
function boundMovementDefinition(
  movement: FleetMovement,
  ruleset: Ruleset,
): { definition: ActionDefinition; move: FleetMoveEffectDefinition } | undefined {
  const poolEntry = ruleset.actionPool.find(({ id }) => id === movement.submission.id)
  if (poolEntry === undefined || poolEntry.actionDefinitionId !== movement.submission.actionDefinitionId) {
    return undefined
  }
  const definition = getOwnRecordValue(ruleset.actionDefinitions, poolEntry.actionDefinitionId)
  const moves = definition?.effects.filter(isFleetMoveEffectDefinition) ?? []
  const move = moves.length === 1 ? moves[0] : undefined
  if (definition === undefined || move === undefined) {
    return undefined
  }
  return { definition, move }
}
function selectionsMatchDefinition(definition: ActionDefinition, movement: FleetMovement): boolean {
  return (
    sameDefinedKeys(definition.targets, movement.submission.selectedTargets) &&
    sameDefinedKeys(definition.inputs, movement.submission.selectedInputs)
  )
}
function sameDefinedKeys(definition: Readonly<Record<string, unknown>>, selection: Readonly<Record<string, unknown>>): boolean {
  return (
    Object.keys(definition).every((tag) => Object.hasOwn(selection, tag)) &&
    Object.keys(selection).every((tag) => Object.hasOwn(definition, tag)) &&
    Object.values(selection).every((value) => value !== undefined)
  )
}
function matchesMovementTargets(
  fleet: Fleet & { movement: FleetMovement; destinationPlanetId: PlanetId },
  state: EligibilityState,
  definition: ActionDefinition,
  move: FleetMoveEffectDefinition,
): boolean {
  const fleetTag = move.targets.fleet.actionTargetTag,
    planetTag = move.targets.planet.actionTargetTag,
    strengthTag = move.inputs.strength.actionInputTag
  if (!hasMovementSlots(definition, move)) {
    return false
  }
  const selectedFleet = getOwnRecordValue(fleet.movement.submission.selectedTargets, fleetTag)
  const selectedPlanet = getOwnRecordValue(fleet.movement.submission.selectedTargets, planetTag)
  const selectedStrength = getOwnRecordValue(fleet.movement.submission.selectedInputs, strengthTag)
  return (
    validSelectedFleet(selectedFleet) &&
    validDestination(selectedPlanet, fleet.destinationPlanetId, state) &&
    validStrength(selectedStrength, fleet.strength)
  )
}
function hasMovementSlots(definition: ActionDefinition, move: FleetMoveEffectDefinition): boolean {
  const fleetTag = move.targets.fleet.actionTargetTag,
    planetTag = move.targets.planet.actionTargetTag,
    strengthTag = move.inputs.strength.actionInputTag
  if (getOwnRecordValue(definition.targets, fleetTag)?.targetType !== TargetType.FLEET) {
    return false
  }
  if (getOwnRecordValue(definition.targets, planetTag)?.targetType !== TargetType.PLANET) {
    return false
  }
  if (getOwnRecordValue(definition.inputs, strengthTag)?.type !== "POSITIVE_INTEGER") {
    return false
  }
  return true
}
function validSelectedFleet(value: unknown): boolean {
  return value !== undefined && FleetIdSchema.safeParse(value).success
}
function validDestination(value: unknown, destination: PlanetId, state: EligibilityState): boolean {
  const parsed = PlanetIdSchema.safeParse(value)
  return parsed.success && parsed.data === destination && getOwnRecordValue(state.planets, parsed.data) !== undefined
}
function validStrength(value: unknown, strength: number): boolean {
  const parsed = PositiveIntegerSchema.safeParse(value)
  return parsed.success && parsed.data === strength
}
function matchesArrivalEffects(definition: ActionDefinition, move: FleetMoveEffectDefinition, movement: FleetMovement): boolean {
  const expected = [...definition.costs, ...definition.effects].flatMap((effectDefinition, definitionOrdinal) =>
    isMappedArrival(effectDefinition, move) ? [{ effectDefinition, definitionOrdinal }] : [],
  )
  return (
    movement.pendingArrivalEffects.length === expected.length &&
    movement.pendingArrivalEffects.every((pending, index) => matchesArrival(pending, expected[index], movement, move))
  )
}
function isMappedArrival(effect: EffectDefinition, move: FleetMoveEffectDefinition): effect is PendingArrivalEffect["effectDefinition"] {
  if (effect.type !== FleetAssaultEffectDefinition.type && effect.type !== FleetColonizeEffectDefinition.type) {
    return false
  }
  return (
    effect.targets.fleet.actionTargetTag === move.targets.fleet.actionTargetTag &&
    effect.targets.planet.actionTargetTag === move.targets.planet.actionTargetTag
  )
}
function matchesArrival(
  pending: PendingArrivalEffect,
  expected: { effectDefinition: PendingArrivalEffect["effectDefinition"]; definitionOrdinal: number } | undefined,
  movement: FleetMovement,
  move: FleetMoveEffectDefinition,
): boolean {
  if (expected === undefined || pending.definitionOrdinal !== expected.definitionOrdinal) {
    return false
  }
  if (!sameArrivalDefinition(pending.effectDefinition, expected.effectDefinition)) {
    return false
  }
  return (
    getOwnRecordValue(movement.submission.selectedTargets, move.targets.fleet.actionTargetTag) ===
      getOwnRecordValue(movement.submission.selectedTargets, pending.effectDefinition.targets.fleet.actionTargetTag) &&
    getOwnRecordValue(movement.submission.selectedTargets, move.targets.planet.actionTargetTag) ===
      getOwnRecordValue(movement.submission.selectedTargets, pending.effectDefinition.targets.planet.actionTargetTag)
  )
}
function sameArrivalDefinition(
  actual: PendingArrivalEffect["effectDefinition"],
  expected: PendingArrivalEffect["effectDefinition"],
): boolean {
  if (actual.type !== expected.type) {
    return false
  }
  if (
    actual.targets.fleet.actionTargetTag !== expected.targets.fleet.actionTargetTag ||
    actual.targets.planet.actionTargetTag !== expected.targets.planet.actionTargetTag
  ) {
    return false
  }
  if (actual.type !== FleetColonizeEffectDefinition.type) {
    return true
  }
  return (
    expected.type === FleetColonizeEffectDefinition.type &&
    actual.parameters.strengthRequirement === expected.parameters.strengthRequirement
  )
}
