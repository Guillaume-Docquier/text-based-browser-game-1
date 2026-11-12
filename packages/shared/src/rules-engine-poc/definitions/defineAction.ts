import type { z } from "zod"
import type { ActionConstraint } from "../constraints/Constraint.ts"
import type { ActionDefinition } from "./ActionDefinition.ts"
import type { RegisteredMechanic } from "./defineMechanic.ts"
import type { Bindings, TargetSlots } from "./TargetSlots.ts"

/**
 * Registry-derived invocation union preserves the correlation between the
 * mechanic name, required slot bindings and parameter schema input.
 */
export type Invocation<T extends TargetSlots, R extends Readonly<Record<string, RegisteredMechanic>>> = {
  [N in keyof R]: {
    readonly use: N
    readonly bind: Bindings<T, R[N]["targets"]>
    readonly parameters: z.input<R[N]["parameterSchema"]>
  }
}[keyof R]
export type AuthoredAction<T extends TargetSlots, R extends Readonly<Record<string, RegisteredMechanic>>> = Omit<
  ActionDefinition,
  "targets" | "mechanics" | "constraints"
> & {
  readonly targets: T
  readonly mechanics: ReadonlyArray<Invocation<T, R>>
  readonly constraints: ReadonlyArray<ActionConstraint<T>>
}

/**
 * Checks trusted authoring at compile time; JSON still goes through the compiler.
 * NoInfer prevents invalid bindings from widening the declared target schema.
 */
export function defineAction<const T extends TargetSlots, R extends Readonly<Record<string, RegisteredMechanic>>>(
  registry: R,
  definition: AuthoredAction<NoInfer<T>, R> & { readonly targets: T },
): AuthoredAction<T, R> {
  // The registry supplies type information without registration side effects.
  void registry
  return definition
}
