import { Result } from "@guillaume-docquier/tools-ts"
import type { z } from "zod"
import type { QuantityOfResource } from "#shared/domain/resources/QuantityOfResource.ts"
import type { CompilationIssue } from "../compiler/CompilationIssue.ts"
import { compileBindings } from "../compiler/compileBindings.ts"
import type { CompiledInvocation, MechanicOutcome, MechanicPhase } from "../compiler/CompiledRuleset.ts"
import type { Constraint } from "../constraints/Constraint.ts"
import type { ExecutionContext } from "../runtime/ExecutionContext.ts"
import { resolveTargets } from "../runtime/resolveTargets.ts"
import type { InvocationDefinition } from "./ActionDefinition.ts"
import type { ResolvedTargets, TargetRefs, TargetSlots } from "./TargetSlots.ts"

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
      const refs = compileBindings(targets, invocation.bind, actionTargets, path)
      const parameters = definition.parameters.safeParse(invocation.parameters)
      if (!parameters.success) {
        return Result.Failure([
          ...(Result.isFailure(refs) ? refs.error : []),
          ...parameters.error.issues.map((issue) => ({
            path: [...path, "parameters", ...issue.path],
            message: issue.message,
          })),
        ])
      }
      if (Result.isFailure(refs)) return refs
      return Result.Success({
        phase: definition.phase,
        requirements: definition.requirements(refs.value, parameters.data),
        resourceSpending: definition.resourceSpending?.(parameters.data) ?? [],
        execute(context, selected) {
          const resolved = resolveTargets(refs.value, selected, context.state)
          if (Result.isFailure(resolved)) return resolved
          return definition.resolve(resolved.value, parameters.data, context)
        },
      })
    },
  }
}
