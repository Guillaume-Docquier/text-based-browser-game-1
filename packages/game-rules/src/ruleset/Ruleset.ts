import { branded, type Branded, type DeepUnbranded, Result, safeTypedParse, typedParse } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#game-rules/models/ActionDefinitionId.ts"
import { RulesetIdSchema, type RulesetId } from "#game-rules/models/RulesetId.ts"
import { type ActionDefinition, ActionDefinitionSchema } from "#game-rules/ruleset/action-definitions/ActionDefinition.ts"
import type { Resources } from "#game-rules/ruleset/effect-definitions/Resources.ts"
import { ResourceTypeSchema } from "#game-rules/ruleset/effect-definitions/ResourceType.ts"
import { type UncompiledPooledAction, UncompiledPooledActionSchema } from "#game-rules/ruleset/UncompiledPooledAction.ts"

/**
 * The authored data-driven rules for a game.
 * The Ruleset integrity is guaranteed by the brand.
 */
export type Ruleset = Branded<
  "Ruleset",
  Readonly<{
    id: RulesetId
    /**
     * The player-facing name of this Ruleset.
     */
    name: string
    /**
     * The default choice when creating games. Only one ruleset can be the default ruleset.
     */
    isDefault: boolean
    actionDefinitions: Readonly<Record<ActionDefinitionId, ActionDefinition>>
    actionPool: readonly UncompiledPooledAction[]
    startingResources: Readonly<Resources>
  }>
>

export const Ruleset = {
  create: (ruleset: DeepUnbranded<Ruleset>): Ruleset => typedParse(RulesetSchema, ruleset),
  safeCreate: (ruleset: DeepUnbranded<Ruleset>): Result<Ruleset, string[]> => {
    const rulesetValidation = safeTypedParse(RulesetSchema, ruleset)
    if (rulesetValidation.success) {
      return Result.Success(rulesetValidation.data)
    }

    const errors = rulesetValidation.error.issues.map((issue) =>
      issue.code === "custom" ? issue.message : z.prettifyError(new z.ZodError([issue])),
    )
    return Result.Failure(errors)
  },
} as const

export const RulesetFieldsSchema = z.object({
  id: RulesetIdSchema,
  name: z.string(),
  isDefault: z.boolean(),
  actionDefinitions: z.record(ActionDefinitionIdSchema, ActionDefinitionSchema).superRefine(validateActionDefinitionIndices),
  actionPool: z.array(UncompiledPooledActionSchema).readonly(),
  startingResources: z.record(ResourceTypeSchema, z.number()),
})

export const RulesetSchema = RulesetFieldsSchema.superRefine(validatePooledActionDefinitionsExist).transform(
  branded<Ruleset>,
) satisfies z.ZodType<Ruleset>

/**
 * Requires that every action definition key is the id of the action definition value.
 */
function validateActionDefinitionIndices(actionDefinitions: Ruleset["actionDefinitions"], context: z.RefinementCtx): void {
  for (const [actualIndex, actionDefinition] of Object.entries(actionDefinitions)) {
    if (actualIndex !== actionDefinition.id) {
      context.addIssue({
        code: "custom",
        message: `Action Definition ${actionDefinition.name} is indexed under ${actualIndex} instead of ${actionDefinition.id}`,
      })
    }
  }
}

export function validatePooledActionDefinitionsExist(
  ruleset: Pick<Ruleset, "actionDefinitions" | "actionPool">,
  context: z.RefinementCtx,
): void {
  for (const [index, action] of ruleset.actionPool.entries()) {
    if (ruleset.actionDefinitions[action.actionDefinitionId] === undefined) {
      context.addIssue({
        code: "custom",
        path: ["actionPool", index, "actionDefinitionId"],
        message: `Action Pool entry ${index} references missing Action Definition ${action.actionDefinitionId}`,
      })
    }
  }
}
