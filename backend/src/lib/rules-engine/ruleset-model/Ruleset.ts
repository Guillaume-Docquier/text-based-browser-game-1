import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import {
  type ActionDefinition,
  ActionDefinitionIdSchema,
  ActionDefinitionSchema,
} from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"
import { ResourceTypeSchema } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

/** The identifier of a Ruleset. */
export type RulesetId = Branded<string, "RulesetId">

/** Parses a string as a Ruleset identifier. */
export const RulesetId = z.string().transform(branded<RulesetId>)

/**
 * The complete data-driven rules for a game.
 */
export type Ruleset = Readonly<{
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

export const RulesetSchema = z.object({
  id: RulesetId,
  name: z.string(),
  isDefault: z.boolean(),
  actionDefinitions: z.record(ActionDefinitionIdSchema, ActionDefinitionSchema),
  startingResources: z.record(ResourceTypeSchema, z.number()),
}) satisfies z.ZodType<Ruleset>
