import { z } from "zod"
import { ActionIdSchema, type ActionId } from "#shared/domain/actions/ActionId.ts"
import { SelectedTargetsSchema, type SelectedTargets } from "#shared/domain/actions/SelectedTargets.ts"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"

export type Action = AvailableAction | SubmittedAction

/**
 * Each Ruleset Action Pool entry gives this Action a stable identifier across turns.
 * The player and turn scope distinguish rows that share that identifier.
 * By default, the action is available and has no selected targets.
 */
export type AvailableAction = Readonly<{
  id: ActionId
  playerId: PlayerId
  actionDefinitionId: ActionDefinitionId
  selectedTargets: null
}>

/**
 * The action is submitted when its selected targets are set.
 */
export type SubmittedAction = Readonly<{
  id: ActionId
  playerId: PlayerId
  actionDefinitionId: ActionDefinitionId
  /**
   * Contains selected target ids keyed by the tags of the action definition's target slots.
   */
  selectedTargets: SelectedTargets
}>

/**
 * Parses an action before target selection.
 */
export const AvailableActionSchema = z.object({
  id: ActionIdSchema,
  playerId: PlayerIdSchema,
  actionDefinitionId: ActionDefinitionIdSchema,
  selectedTargets: z.null(),
}) satisfies z.ZodType<AvailableAction>

/**
 * Parses an action with selected targets.
 */
export const SubmittedActionSchema = z.object({
  id: ActionIdSchema,
  playerId: PlayerIdSchema,
  actionDefinitionId: ActionDefinitionIdSchema,
  selectedTargets: SelectedTargetsSchema,
}) satisfies z.ZodType<SubmittedAction>

/**
 * Parses either an available action or a submitted action.
 */
export const ActionSchema = z.union([AvailableActionSchema, SubmittedActionSchema]) satisfies z.ZodType<Action>
