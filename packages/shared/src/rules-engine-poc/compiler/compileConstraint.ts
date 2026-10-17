import { Result } from "@guillaume-docquier/tools-ts"
import type { Constraint, ParsedConstraint } from "../constraints/Constraint.ts"
import type { TargetKind, TargetRef, TargetSlots } from "../definitions/TargetSlots.ts"
import type { CompilationIssue } from "./CompilationIssue.ts"

type ConstraintCompilation = Readonly<{ targets: TargetSlots; path: readonly PropertyKey[] }>

/**
 * Resolves authored predicate references in the declared action target namespace.
 */
export function compileConstraint(
  constraint: ParsedConstraint,
  targets: TargetSlots,
  path: readonly PropertyKey[],
): Result<Constraint, CompilationIssue[]> {
  const context = { targets, path }
  switch (constraint.kind) {
    case "ownedByActor":
      return Result.map(compileRef(constraint.target, ["fleet", "planet"], "target", context), {
        success: (target): Constraint => ({ kind: constraint.kind, target }),
      })
    case "strengthAtLeast":
      return Result.map(compileRef(constraint.fleet, ["fleet"], "fleet", context), {
        success: (fleet): Constraint => ({ kind: constraint.kind, fleet, value: constraint.value }),
      })
    case "different":
      return compileDifference(constraint, context)
    case "inRange":
      return compileRange(constraint, context)
  }
}

function compileRef<K extends TargetKind>(
  name: string,
  kinds: readonly K[],
  field: string,
  { targets, path }: ConstraintCompilation,
): Result<TargetRef<K>, CompilationIssue[]> {
  const actualKind = Object.hasOwn(targets, name) ? targets[name] : undefined
  const kind = kinds.find((candidate) => candidate === actualKind)
  if (kind === undefined) return Result.Failure([{ path: [...path, field], message: `Expected ${kinds.join(" or ")} target "${name}"` }])
  return Result.Success({ name, kind })
}

function compileDifference(
  constraint: Extract<ParsedConstraint, { kind: "different" }>,
  context: ConstraintCompilation,
): Result<Constraint, CompilationIssue[]> {
  const a = compileRef(constraint.a, ["fleet", "planet", "player"], "a", context)
  const b = compileRef(constraint.b, ["fleet", "planet", "player"], "b", context)
  if (Result.isFailure(a)) return a
  if (Result.isFailure(b)) return b
  return Result.Success({ kind: constraint.kind, a: a.value, b: b.value })
}

function compileRange(
  constraint: Extract<ParsedConstraint, { kind: "inRange" }>,
  context: ConstraintCompilation,
): Result<Constraint, CompilationIssue[]> {
  const fleet = compileRef(constraint.fleet, ["fleet"], "fleet", context)
  const planet = compileRef(constraint.planet, ["planet"], "planet", context)
  if (Result.isFailure(fleet)) return fleet
  if (Result.isFailure(planet)) return planet
  return Result.Success({ kind: constraint.kind, fleet: fleet.value, planet: planet.value, range: constraint.range })
}
