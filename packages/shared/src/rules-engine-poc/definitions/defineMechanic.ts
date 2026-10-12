import { Result } from "@guillaume-docquier/tools-ts"
import type { z } from "zod"
import type { QuantityOfResource } from "#shared/domain/resources/QuantityOfResource.ts"
import type { CompilationIssue } from "../compiler/CompilationIssue.ts"
import type { CompiledInvocation, MechanicOutcome, MechanicPhase } from "../compiler/CompiledRuleset.ts"
import type { Constraint } from "../constraints/Constraint.ts"
import type { ExecutionContext } from "../runtime/ExecutionContext.ts"
import { resolveTargets } from "../runtime/resolveTargets.ts"
import type { InvocationDefinition } from "./ActionDefinition.ts"
import type { ResolvedTargets, TargetRef, TargetRefs, TargetSlots } from "./TargetSlots.ts"

/**
 * Common compilation capability retained when heterogeneous mechanics enter a registry.
 */
export type RegisteredMechanic = Readonly<{
  targets: TargetSlots
  parameterSchema: z.ZodType
  compile: (
    invocation: InvocationDefinition,
    actionTargets: TargetSlots,
    path: readonly PropertyKey[],
  ) => Result<CompiledInvocation, CompilationIssue[]>
}>
export type Mechanic<T extends TargetSlots, S extends z.ZodType> = Omit<RegisteredMechanic, "targets" | "parameterSchema"> &
  Readonly<{ targets: T; parameterSchema: S }>

/**
 * Captures typed mechanic inputs in a compilation closure. Runtime callers see
 * a uniform executable contract rather than casting a heterogeneous resolver.
 */
export function defineMechanic<const T extends TargetSlots, S extends z.ZodType>(definition: {
  targets: T
  parameters: S
  phase: MechanicPhase
  requirements: (refs: TargetRefs<T>, parameters: z.output<S>) => readonly Constraint[]
  resourceSpending?: (parameters: z.output<S>) => readonly QuantityOfResource[]
  resolve: (
    targets: ResolvedTargets<T>,
    parameters: z.output<S>,
    context: ExecutionContext,
  ) => Result<readonly MechanicOutcome[], CompilationIssue[]>
}): Mechanic<T, S> {
  const targets = Object.freeze({ ...definition.targets })
  return {
    targets,
    parameterSchema: definition.parameters,
    compile(invocation, actionTargets, path) {
      const issues: CompilationIssue[] = []
      const refs: Record<string, TargetRef> = Object.create(null)
      for (const [slot, kind] of Object.entries(targets)) {
        const name = Object.hasOwn(invocation.bind, slot) ? invocation.bind[slot] : undefined
        if (name === undefined) {
          issues.push({ path: [...path, "bind", slot], message: "Missing required binding" })
        } else if (!Object.hasOwn(actionTargets, name)) {
          issues.push({ path: [...path, "bind", slot], message: `Unknown action target "${name}"` })
        } else if (actionTargets[name] !== kind) {
          issues.push({ path: [...path, "bind", slot], message: `Expected ${kind} target, got ${actionTargets[name]}` })
        } else {
          refs[slot] = Object.freeze({ name, kind })
        }
      }
      for (const slot of Object.keys(invocation.bind)) {
        if (!Object.hasOwn(targets, slot)) issues.push({ path: [...path, "bind", slot], message: "Unexpected mechanic slot" })
      }
      const parameters = definition.parameters.safeParse(invocation.parameters)
      if (!parameters.success) {
        issues.push(
          ...parameters.error.issues.map((issue) => ({
            path: [...path, "parameters", ...issue.path],
            message: issue.message,
          })),
        )
      }
      if (issues.length > 0) return Result.Failure(issues)
      if (!parameters.success) return Result.Failure(issues)
      // SAFETY: The loop above constructed every slot with exactly its declared
      // kind and checked the referenced action target. All failures exited.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Required slots, action references and kinds were checked above.
      const typedRefs = Object.freeze(refs) as TargetRefs<T>
      return Result.Success({
        phase: definition.phase,
        requirements: definition.requirements(typedRefs, parameters.data),
        resourceSpending: definition.resourceSpending?.(parameters.data) ?? [],
        execute(context, selected) {
          const resolved = resolveTargets(typedRefs, selected, context.state)
          if (Result.isFailure(resolved)) return resolved
          return definition.resolve(resolved.value, parameters.data, context)
        },
      })
    },
  }
}
