import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { TargetEntities, TargetKind, TargetRef } from "../definitions/TargetSlots.ts"
import type { ExecutionState } from "../runtime/ExecutionContext.ts"
import { findTarget } from "../runtime/resolveTargets.ts"
import type { Constraint } from "./Constraint.ts"

/**
 * Missing selections defer evaluation; selected unknown IDs violate it.
 */
export type ConstraintResult = "satisfied" | "violated" | "undetermined"
type EvaluationContext = Readonly<{
  selected: Readonly<Record<string, string>>
  actorId: PlayerId
  state: ExecutionState
}>

/**
 * Evaluates predicates against a partial or complete assignment of action targets.
 */
export function evaluateConstraints(
  constraints: readonly Constraint[],
  selected: Readonly<Record<string, string>>,
  actorId: PlayerId,
  state: ExecutionState,
): readonly ConstraintResult[] {
  const context = { selected, actorId, state }
  return constraints.map((constraint) => evaluate(constraint, context))
}

function evaluate(constraint: Constraint, context: EvaluationContext): ConstraintResult {
  const status = dependencyStatus(dependencies(constraint), context)
  if (status !== undefined) return status
  return satisfies(constraint, context) ? "satisfied" : "violated"
}

function dependencyStatus(refs: readonly TargetRef[], context: EvaluationContext): ConstraintResult | undefined {
  if (refs.some((ref) => Object.hasOwn(context.selected, ref.name) && entity(ref, context) === undefined)) return "violated"
  if (refs.some((ref) => !Object.hasOwn(context.selected, ref.name))) return "undetermined"
  return undefined
}

function entity<K extends TargetKind>(ref: TargetRef<K>, { selected, state }: EvaluationContext): TargetEntities[K] | undefined {
  return findTarget(ref.kind, selected[ref.name] ?? "", state)
}

function satisfies(constraint: Constraint, context: EvaluationContext): boolean {
  switch (constraint.kind) {
    case "ownedByActor":
      return entity(constraint.target, context)?.ownerPlayerId === context.actorId
    case "strengthAtLeast":
      return hasMinimumStrength(constraint, context)
    case "different":
      return constraint.a.kind !== constraint.b.kind || context.selected[constraint.a.name] !== context.selected[constraint.b.name]
    case "inRange":
      return isInRange(constraint, context)
  }
}

function hasMinimumStrength(constraint: Extract<Constraint, { kind: "strengthAtLeast" }>, context: EvaluationContext): boolean {
  return (entity(constraint.fleet, context)?.strength ?? -Infinity) >= constraint.value
}

function isInRange(constraint: Extract<Constraint, { kind: "inRange" }>, context: EvaluationContext): boolean {
  const fleet = entity(constraint.fleet, context)
  const planet = entity(constraint.planet, context)
  const origin = fleet === undefined ? undefined : context.state.planets[fleet.originPlanetId]
  return origin !== undefined && planet !== undefined && Math.hypot(planet.x - origin.x, planet.y - origin.y) <= constraint.range
}

function dependencies(constraint: Constraint): readonly TargetRef[] {
  switch (constraint.kind) {
    case "ownedByActor":
      return [constraint.target]
    case "strengthAtLeast":
      return [constraint.fleet]
    case "different":
      return [constraint.a, constraint.b]
    case "inRange":
      return [constraint.fleet, constraint.planet]
  }
}
