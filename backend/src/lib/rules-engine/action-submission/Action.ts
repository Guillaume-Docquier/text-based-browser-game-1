import { z } from "zod"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import { type actionsTable } from "#lib/db/schema.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { ResolvedTargets } from "#lib/rules-engine/ruleset-model/actions/ResolvedTargets.ts"

export type ActionId = z.infer<typeof PlayerId>
export const ActionId = z.string() satisfies z.ZodType<(typeof actionsTable.$inferSelect)["id"]>

export type Action = AvailableAction | SubmittedAction

/**
 * All actions are defined by a unique identifier, for a specific player and reference an action definition.
 * By default, the action is available and has no targets set.
 */
export type AvailableAction = Readonly<{
  id: ActionId
  playerId: PlayerId
  actionDefinitionId: ActionDefinition["id"]
  targets: null
}>

/**
 * The action is submitted when its targets are set
 */
export type SubmittedAction = Readonly<{
  id: ActionId
  playerId: PlayerId
  actionDefinitionId: ActionDefinition["id"]
  /**
   * Contains the targets to fill required by the ActionDefinition.
   * Contains the special "self" key that the server will always override.
   */
  targets: ResolvedTargets
}>
