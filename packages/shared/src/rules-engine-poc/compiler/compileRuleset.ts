import { branded, Result } from "@guillaume-docquier/tools-ts"
import type { Constraint, ParsedConstraint } from "../constraints/Constraint.ts"
import type { ParsedActionDefinition } from "../definitions/ActionDefinition.ts"
import type { RegisteredMechanic } from "../definitions/defineMechanic.ts"
import type { TargetKind, TargetRef, TargetSlots } from "../definitions/TargetSlots.ts"
import { mechanicRegistry } from "../mechanics/mechanicRegistry.ts"
import { spendResources } from "../mechanics/spendResources.ts"
import type { CompilationIssue } from "./CompilationIssue.ts"
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
  const actions = new Map<string, CompiledAction>()
  const issues: CompilationIssue[] = []
  for (const [index, action] of definition.actionDefinitions.entries()) {
    const path = ["actionDefinitions", index]
    if (actions.has(action.id)) {
      issues.push({ path: [...path, "id"], message: "Duplicate action definition ID" })
      continue
    }
    const compiled = compileAction(action, registry, path)
    if (Result.isFailure(compiled)) issues.push(...compiled.error)
    else actions.set(action.id, compiled.value)
  }
  const actionIds = new Set<string>()
  for (const [index, entry] of definition.actionPool.entries()) {
    if (actionIds.has(entry.id)) issues.push({ path: ["actionPool", index, "id"], message: "Duplicate pooled action ID" })
    actionIds.add(entry.id)
    if (!definition.actionDefinitions.some((action) => action.id === entry.actionDefinitionId)) {
      issues.push({ path: ["actionPool", index, "actionDefinitionId"], message: "Unknown action definition" })
    }
  }
  for (const [resource, quantity] of Object.entries(definition.startingResources)) {
    if (quantity < 0) issues.push({ path: ["startingResources", resource], message: "Starting resources cannot be negative" })
  }
  return issues.length > 0 ? Result.Failure(issues) : Result.Success(branded<CompiledRuleset>({ definition, actions }))
}

function compileAction(
  definition: ParsedActionDefinition,
  registry: Readonly<Record<string, RegisteredMechanic>>,
  path: readonly PropertyKey[],
): Result<CompiledAction, CompilationIssue[]> {
  const issues: CompilationIssue[] = []
  const mechanics: CompiledInvocation[] = []
  const costs: CompiledInvocation[] = []
  const constraints: Constraint[] = []
  for (const [index, invocation] of definition.mechanics.entries()) {
    const mechanic = Object.hasOwn(registry, invocation.use) ? registry[invocation.use] : undefined
    if (mechanic === undefined) {
      issues.push({ path: [...path, "mechanics", index, "use"], message: `Unknown mechanic "${invocation.use}"` })
      continue
    }
    const result = mechanic.compile(invocation, definition.targets, [...path, "mechanics", index])
    if (Result.isFailure(result)) issues.push(...result.error)
    else {
      mechanics.push(result.value)
      constraints.push(...result.value.requirements)
    }
  }
  for (const [index, parameters] of definition.costs.entries()) {
    const result = spendResources.compile({ use: "spendResources", bind: {}, parameters }, definition.targets, [...path, "costs", index])
    if (Result.isFailure(result)) issues.push(...result.error)
    else costs.push(result.value)
  }
  for (const [index, constraint] of definition.constraints.entries()) {
    const result = compileConstraint(constraint, definition.targets, [...path, "constraints", index])
    if (Result.isFailure(result)) issues.push(...result.error)
    else constraints.push(result.value)
  }
  return issues.length > 0 ? Result.Failure(issues) : Result.Success({ definition, mechanics, costs, constraints })
}

function compileConstraint(
  constraint: ParsedConstraint,
  targets: TargetSlots,
  path: readonly PropertyKey[],
): Result<Constraint, CompilationIssue[]> {
  function ref<K extends TargetKind>(name: string, kinds: readonly K[], field: string): Result<TargetRef<K>, CompilationIssue[]> {
    const actualKind = Object.hasOwn(targets, name) ? targets[name] : undefined
    const kind = kinds.find((candidate) => candidate === actualKind)
    if (kind === undefined) return Result.Failure([{ path: [...path, field], message: `Expected ${kinds.join(" or ")} target "${name}"` }])
    return Result.Success({ name, kind })
  }
  switch (constraint.kind) {
    case "ownedByActor": {
      const target = ref(constraint.target, ["fleet", "planet"], "target")
      return Result.isFailure(target) ? target : Result.Success({ kind: constraint.kind, target: target.value })
    }
    case "strengthAtLeast": {
      const fleet = ref(constraint.fleet, ["fleet"], "fleet")
      return Result.isFailure(fleet) ? fleet : Result.Success({ kind: constraint.kind, fleet: fleet.value, value: constraint.value })
    }
    case "different": {
      const a = ref(constraint.a, ["fleet", "planet", "player"], "a")
      const b = ref(constraint.b, ["fleet", "planet", "player"], "b")
      if (Result.isFailure(a)) return a
      if (Result.isFailure(b)) return b
      return Result.Success({ kind: constraint.kind, a: a.value, b: b.value })
    }
    case "inRange": {
      const fleet = ref(constraint.fleet, ["fleet"], "fleet")
      const planet = ref(constraint.planet, ["planet"], "planet")
      if (Result.isFailure(fleet)) return fleet
      if (Result.isFailure(planet)) return planet
      return Result.Success({ kind: constraint.kind, fleet: fleet.value, planet: planet.value, range: constraint.range })
    }
  }
}
