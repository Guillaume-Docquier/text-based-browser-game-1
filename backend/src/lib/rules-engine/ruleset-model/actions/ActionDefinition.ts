import { z } from "zod"
import { ActionTierSchema, type ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import { ActionTypeSchema, type ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"
import {
  ResourceLossMechanicSchema,
  type ResourceLossMechanic,
} from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { MechanicSchema, type Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"

/**
 * The definition of an Action.
 */
export type ActionDefinitionId = string
export const ActionDefinitionIdSchema = z.string() satisfies z.ZodType<ActionDefinitionId>

export type ActionDefinition = Readonly<{
  /**
   * Unique action definition id for reference in action submissions.
   */
  id: ActionDefinitionId
  /**
   * Displayed in the UI.
   */
  name: string
  type: ActionType
  tier: ActionTier
  /**
   * Target entries must match all the costs and mechanics target tags.
   * An Action will use the keys from the ActionDefinition and fill the value with the proper id.
   * self is a special key that's always present that the server will always override.
   */
  targets: Readonly<{ self: "" } & Record<string, "">>
  costs: ResourceLossMechanic[]
  mechanics: Mechanic[]
}>

export const ActionDefinitionTargetsSchema = z.object({ self: z.literal("") }).catchall(z.literal("")) satisfies z.ZodType<
  ActionDefinition["targets"]
>

export const ActionDefinitionSchema = z.object({
  id: ActionDefinitionIdSchema,
  name: z.string(),
  type: ActionTypeSchema,
  tier: ActionTierSchema,
  targets: ActionDefinitionTargetsSchema,
  costs: z.array(ResourceLossMechanicSchema),
  mechanics: z.array(MechanicSchema),
})
