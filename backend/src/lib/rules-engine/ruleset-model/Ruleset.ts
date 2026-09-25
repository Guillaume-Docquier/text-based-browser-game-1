import { branded, type Branded, Result, type Unbranded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { RulesetIdSchema, type RulesetId } from "#lib/db/rulesets/RulesetId.ts"
import {
  type ActionDefinition,
  ActionDefinitionIdSchema,
  ActionDefinitionSchema,
} from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"
import { ResourceTypeSchema } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
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
    actionDefinitions: Readonly<Record<ActionDefinition["id"], ActionDefinition>>
    startingResources: Readonly<Resources>
  }>
>

export const Ruleset = {
  create: (ruleset: UnbrandedProperties<Unbranded<Ruleset>>): Ruleset => typedParse(RulesetSchema, ruleset),
  safeCreate: (ruleset: UnbrandedProperties<Unbranded<Ruleset>>): Result<Ruleset, string[]> => {
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
    startingResources: z.record(ResourceTypeSchema, z.number()),
  })
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
