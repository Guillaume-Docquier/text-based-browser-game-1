import { branded, type Branded, type DeepUnbranded, typedParse } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { ActionDefinitionId } from "#game-rules/models/ActionDefinitionId.ts"
import type { RulesetId } from "#game-rules/models/RulesetId.ts"
import type { ActionDefinition } from "#game-rules/ruleset/action-definitions/ActionDefinition.ts"
import type { Resources } from "#game-rules/ruleset/effect-definitions/Resources.ts"
import { type PooledAction, PooledActionSchema } from "#game-rules/ruleset/PooledAction.ts"
import { RulesetFieldsSchema, validatePooledActionDefinitionsExist } from "#game-rules/ruleset/Ruleset.ts"

/** The validated Ruleset consumed by gameplay. */
export type CompiledRuleset = Branded<
  "CompiledRuleset",
  Readonly<{
    id: RulesetId
    name: string
    isDefault: boolean
    actionDefinitions: Readonly<Record<ActionDefinitionId, ActionDefinition>>
    actionPool: readonly PooledAction[]
    startingResources: Readonly<Resources>
  }>
>

export const CompiledRulesetSchema = RulesetFieldsSchema.safeExtend({
  actionPool: z.array(PooledActionSchema).readonly().superRefine(validateUniquePooledActionIds),
})
  .superRefine(validatePooledActionDefinitionsExist)
  .transform(branded<CompiledRuleset>) satisfies z.ZodType<CompiledRuleset>

export const CompiledRuleset = {
  create: (ruleset: DeepUnbranded<CompiledRuleset>): CompiledRuleset => typedParse(CompiledRulesetSchema, ruleset),
} as const

function validateUniquePooledActionIds(actionPool: CompiledRuleset["actionPool"], context: z.RefinementCtx): void {
  const ids = new Set<string>()
  for (const [index, action] of actionPool.entries()) {
    if (ids.has(action.id)) {
      context.addIssue({ code: "custom", path: [index, "id"], message: `Action Pool contains duplicate action id ${action.id}` })
    }
    ids.add(action.id)
  }
}
