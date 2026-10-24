import type { Branded, Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { QuantityOfResource } from "#shared/domain/resources/QuantityOfResource.ts"
import type { Constraint } from "../constraints/Constraint.ts"
import type { ParsedActionDefinition } from "../definitions/ActionDefinition.ts"
import type { RulesetDefinition } from "../definitions/RulesetDefinition.ts"
import type { ExecutionContext } from "../runtime/ExecutionContext.ts"
import type { CompilationIssue } from "./CompilationIssue.ts"

/**
 * Engine-owned phase ordering. Invocation order only breaks phase ties.
 */
export const MechanicPhases = ["payCosts", "fleetMovement", "fleetBuild", "income", "victory"] as const
export type MechanicPhase = (typeof MechanicPhases)[number]
export type MechanicOutcome = Readonly<{ status: "resolved" | "prevented"; message: string }>
export type CompiledInvocation = Readonly<{
  phase: MechanicPhase
  requirements: readonly Constraint[]
  resourceSpending: readonly QuantityOfResource[]
  execute: (context: ExecutionContext, selected: Readonly<Record<string, string>>) => Result<readonly MechanicOutcome[], CompilationIssue[]>
}>
export type CompiledAction = Readonly<{
  definition: ReadonlyDeep<ParsedActionDefinition>
  constraints: readonly Constraint[]
  costs: readonly CompiledInvocation[]
  mechanics: readonly CompiledInvocation[]
}>
/**
 * Records successful structural and semantic compilation of the ruleset.
 */
export type CompiledRuleset = Branded<
  "CompiledPocRuleset",
  Readonly<{
    definition: ReadonlyDeep<RulesetDefinition>
    actions: ReadonlyMap<string, CompiledAction>
  }>
>
