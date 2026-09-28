import { branded, type Branded, type DeepUnbranded, Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { ActionId } from "#lib/db/actions/ActionId.ts"
import { RulesetIdSchema, type RulesetId } from "#lib/db/rulesets/RulesetId.ts"
import {
  type ActionDefinition,
  type ActionDefinitionId,
  ActionDefinitionIdSchema,
  ActionDefinitionSchema,
} from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"
import type { Resources } from "#lib/rules-engine/ruleset/effect-definitions/Resources.ts"
import { ResourceTypeSchema } from "#lib/rules-engine/ruleset/effect-definitions/ResourceType.ts"
import { type PooledAction, PooledActionSchema } from "#lib/rules-engine/ruleset/PooledAction.ts"
import { safeTypedParse, typedParse } from "#lib/validation/typedParse.ts"

/**
 * The complete data-driven rules for a game.
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
    actionPool: readonly PooledAction[]
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

export const RulesetSchema = z
  .object({
    id: RulesetIdSchema,
    name: z.string(),
    isDefault: z.boolean(),
    actionDefinitions: z.record(ActionDefinitionIdSchema, ActionDefinitionSchema).superRefine(validateActionDefinitionIndices),
    actionPool: z.array(PooledActionSchema).readonly().superRefine(validateUniquePooledActionIds),
    startingResources: z.record(ResourceTypeSchema, z.number()),
  })
  .superRefine(validatePooledActionDefinitionsExist)
  .transform(branded<Ruleset>) satisfies z.ZodType<Ruleset>

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

function validateUniquePooledActionIds(actionPool: Ruleset["actionPool"], context: z.RefinementCtx): void {
  const actionIds = new Set<ActionId>()

  for (const [index, action] of actionPool.entries()) {
    if (actionIds.has(action.id)) {
      context.addIssue({
        code: "custom",
        path: [index, "id"],
        message: `Action Pool contains duplicate action id ${action.id}`,
      })
    }
    actionIds.add(action.id)
  }
}

function validatePooledActionDefinitionsExist(ruleset: Pick<Ruleset, "actionDefinitions" | "actionPool">, context: z.RefinementCtx): void {
  for (const [index, action] of ruleset.actionPool.entries()) {
    if (ruleset.actionDefinitions[action.actionDefinitionId] === undefined) {
      context.addIssue({
        code: "custom",
        path: ["actionPool", index, "actionDefinitionId"],
        message: `Action Pool action ${action.id} references missing Action Definition ${action.actionDefinitionId}`,
      })
    }
  }
}
