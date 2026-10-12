import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { TargetEntities, TargetKind, TargetRef } from "../definitions/TargetSlots.ts"
import type { ExecutionState } from "../runtime/ExecutionContext.ts"
import { findTarget } from "../runtime/resolveTargets.ts"
import type { Constraint } from "./Constraint.ts"

/**
 * Missing selections defer evaluation; selected unknown IDs violate it.
 */
export type ConstraintResult = "satisfied" | "violated" | "undetermined"
export function evaluateConstraints(
  constraints: readonly Constraint[],
  selected: Readonly<Record<string, string>>,
  actorId: PlayerId,
  state: ExecutionState,
): readonly ConstraintResult[] {
  return constraints.map((constraint) => evaluate(constraint, selected, actorId, state))
}
function evaluate(
  constraint: Constraint,
  selected: Readonly<Record<string, string>>,
  actorId: PlayerId,
  state: ExecutionState,
): ConstraintResult {
  const refs = dependencies(constraint)
  if (refs.some((ref) => Object.hasOwn(selected, ref.name) && findTarget(ref.kind, selected[ref.name] ?? "", state) === undefined))
    return "violated"
  if (refs.some((ref) => !Object.hasOwn(selected, ref.name))) return "undetermined"
  function entity<K extends TargetKind>(ref: TargetRef<K>): TargetEntities[K] | undefined {
    return findTarget(ref.kind, selected[ref.name] ?? "", state)
  }
  let satisfied: boolean
  switch (constraint.kind) {
    case "ownedByActor":
      satisfied = entity(constraint.target)?.ownerPlayerId === actorId
      break
    case "strengthAtLeast":
      satisfied = (entity(constraint.fleet)?.strength ?? -Infinity) >= constraint.value
      break
    case "different":
      satisfied = constraint.a.kind !== constraint.b.kind || selected[constraint.a.name] !== selected[constraint.b.name]
      break
    case "inRange": {
      const fleet = entity(constraint.fleet)
      const planet = entity(constraint.planet)
      const origin = fleet === undefined ? undefined : state.planets[fleet.originPlanetId]
      satisfied = origin !== undefined && planet !== undefined && Math.hypot(planet.x - origin.x, planet.y - origin.y) <= constraint.range
      break
    }
  }
  return satisfied ? "satisfied" : "violated"
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
