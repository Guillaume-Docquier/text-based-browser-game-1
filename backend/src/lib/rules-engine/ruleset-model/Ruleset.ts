import z from "zod"
import {
  type ActionDefinition,
  ActionDefinitionIdSchema,
  ActionDefinitionSchema,
} from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"

/**
 * The complete data-driven rules for a game.
 */
export type Ruleset = Readonly<{
  /**
   * The player-facing name of this Ruleset.
   */
  name: string
  actionDefinitions: Readonly<Record<ActionDefinition["id"], ActionDefinition>>
}>

export const RulesetSchema = z.object({
  name: z.string(),
  actionDefinitions: z.record(ActionDefinitionIdSchema, ActionDefinitionSchema),
})
