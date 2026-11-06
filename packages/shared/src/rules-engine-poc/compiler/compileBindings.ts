import { Result } from "@guillaume-docquier/tools-ts"
import type { TargetKind, TargetRef, TargetRefs, TargetSlots } from "../definitions/TargetSlots.ts"
import type { CompilationIssue } from "./CompilationIssue.ts"

/**
 * Validates exact mechanic slots and constructs their typed action references.
 */
export function compileBindings<T extends TargetSlots>(
  targets: T,
  bind: Readonly<Record<string, string>>,
  actionTargets: TargetSlots,
  path: readonly PropertyKey[],
): Result<TargetRefs<T>, CompilationIssue[]> {
  const issues: CompilationIssue[] = []
  const refs: Record<string, TargetRef> = Object.create(null)
  for (const [slot, kind] of Object.entries(targets)) {
    const name = Object.hasOwn(bind, slot) ? bind[slot] : undefined
    const result = compileBinding(name, kind, actionTargets, [...path, "bind", slot])
    if (Result.isFailure(result)) issues.push(...result.error)
    else refs[slot] = result.value
  }
  issues.push(
    ...Object.keys(bind)
      .filter((slot) => !Object.hasOwn(targets, slot))
      .map((slot) => ({ path: [...path, "bind", slot], message: "Unexpected mechanic slot" })),
  )
  if (issues.length > 0) return Result.Failure(issues)
  // SAFETY: Every declared slot has a reference with exactly its declared kind
  // and a matching action target. Missing, extra and invalid bindings returned Failure.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: All slots and their action target kinds were validated above.
  return Result.Success(Object.freeze(refs) as TargetRefs<T>)
}

function compileBinding(
  name: string | undefined,
  kind: TargetKind,
  actionTargets: TargetSlots,
  path: readonly PropertyKey[],
): Result<TargetRef, CompilationIssue[]> {
  if (name === undefined) return Result.Failure([{ path, message: "Missing required binding" }])
  if (!Object.hasOwn(actionTargets, name)) return Result.Failure([{ path, message: `Unknown action target "${name}"` }])
  if (actionTargets[name] !== kind) return Result.Failure([{ path, message: `Expected ${kind} target, got ${actionTargets[name]}` }])
  return Result.Success(Object.freeze({ name, kind }))
}
