import { branded, Result } from "@guillaume-docquier/tools-ts"
import type { InvocationDefinition, ParsedActionDefinition } from "../definitions/ActionDefinition.ts"
import type { RegisteredMechanic } from "../definitions/defineMechanic.ts"
import type { RulesetDefinition } from "../definitions/RulesetDefinition.ts"
import { mechanicRegistry } from "../mechanics/mechanicRegistry.ts"
import { spendResources } from "../mechanics/spendResources.ts"
import type { CompilationIssue } from "./CompilationIssue.ts"
import { compileConstraint } from "./compileConstraint.ts"
import type { CompiledAction, CompiledInvocation, CompiledRuleset } from "./CompiledRuleset.ts"
import { parseRuleset } from "./parseRuleset.ts"

/**
 * Compiles unknown JSON into executable actions. Mandatory requirements are
 * appended by the engine, so player-authored constraints cannot weaken them.
 */
export function compileRuleset(
  input: unknown,
  registry: Readonly<Record<string, RegisteredMechanic>> = mechanicRegistry,
): Result<CompiledRuleset, CompilationIssue[]> {
  const parsed = parseRuleset(input)
  if (Result.isFailure(parsed)) return parsed
  const definition = parsed.value
  const { actions, issues } = compileDefinitions(definition.actionDefinitions, registry)
  issues.push(...validatePool(definition), ...validateStartingResources(definition.startingResources))
  return issues.length > 0 ? Result.Failure(issues) : Result.Success(branded<CompiledRuleset>({ definition, actions }))
}

function compileDefinitions(
  definitions: readonly ParsedActionDefinition[],
  registry: Readonly<Record<string, RegisteredMechanic>>,
): { actions: Map<string, CompiledAction>; issues: CompilationIssue[] } {
  const actions = new Map<string, CompiledAction>()
  const issues: CompilationIssue[] = []
  for (const [index, action] of definitions.entries()) {
    const path = ["actionDefinitions", index]
    if (actions.has(action.id)) {
      issues.push({ path: [...path, "id"], message: "Duplicate action definition ID" })
      continue
    }
    const compiled = compileAction(action, registry, path)
    if (Result.isFailure(compiled)) issues.push(...compiled.error)
    else actions.set(action.id, compiled.value)
  }
  return { actions, issues }
}

function validatePool(definition: RulesetDefinition): CompilationIssue[] {
  const issues: CompilationIssue[] = []
  const actionIds = new Set<string>()
  const definitionIds = new Set(definition.actionDefinitions.map((action) => action.id))
  for (const [index, entry] of definition.actionPool.entries()) {
    if (actionIds.has(entry.id)) issues.push({ path: ["actionPool", index, "id"], message: "Duplicate pooled action ID" })
    actionIds.add(entry.id)
    if (!definitionIds.has(entry.actionDefinitionId)) {
      issues.push({ path: ["actionPool", index, "actionDefinitionId"], message: "Unknown action definition" })
    }
  }
  return issues
}

function validateStartingResources(resources: RulesetDefinition["startingResources"]): CompilationIssue[] {
  return Object.entries(resources)
    .filter(([, quantity]) => quantity < 0)
    .map(([resource]) => ({ path: ["startingResources", resource], message: "Starting resources cannot be negative" }))
}

function compileAction(
  definition: ParsedActionDefinition,
  registry: Readonly<Record<string, RegisteredMechanic>>,
  path: readonly PropertyKey[],
): Result<CompiledAction, CompilationIssue[]> {
  const mechanics = collectCompilation(
    definition.mechanics.map((invocation, index) =>
      compileInvocation(invocation, registry, definition.targets, [...path, "mechanics", index]),
    ),
  )
  const costs = collectCompilation(
    definition.costs.map((parameters, index) =>
      spendResources.compile({ use: "spendResources", bind: {}, parameters }, definition.targets, [...path, "costs", index]),
    ),
  )
  const constraints = collectCompilation(
    definition.constraints.map((constraint, index) => compileConstraint(constraint, definition.targets, [...path, "constraints", index])),
  )
  const issues = [...mechanics.issues, ...costs.issues, ...constraints.issues]
  return issues.length > 0
    ? Result.Failure(issues)
    : Result.Success({
        definition,
        mechanics: mechanics.values,
        costs: costs.values,
        constraints: [...mechanics.values.flatMap((invocation) => invocation.requirements), ...constraints.values],
      })
}

function compileInvocation(
  invocation: InvocationDefinition,
  registry: Readonly<Record<string, RegisteredMechanic>>,
  targets: ParsedActionDefinition["targets"],
  path: readonly PropertyKey[],
): Result<CompiledInvocation, CompilationIssue[]> {
  const mechanic = Object.hasOwn(registry, invocation.use) ? registry[invocation.use] : undefined
  if (mechanic === undefined) {
    return Result.Failure([{ path: [...path, "use"], message: `Unknown mechanic "${invocation.use}"` }])
  }
  return mechanic.compile(invocation, targets, path)
}

function collectCompilation<T>(results: ReadonlyArray<Result<T, CompilationIssue[]>>): { values: T[]; issues: CompilationIssue[] } {
  const values: T[] = []
  const issues: CompilationIssue[] = []
  for (const result of results) {
    if (Result.isFailure(result)) issues.push(...result.error)
    else values.push(result.value)
  }
  return { values, issues }
}
