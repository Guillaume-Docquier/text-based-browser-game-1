import type { ActionId } from "#lib/db/actions/ActionId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { SelectedTargets } from "#lib/rules-engine/ruleset-model/actions/SelectedTargets.ts"

export type Action = AvailableAction | SubmittedAction

/**
 * All actions are defined by a unique identifier, for a specific player and reference an action definition.
 * By default, the action is available and has no selected targets.
 */
export type AvailableAction = Readonly<{
  id: ActionId
  playerId: PlayerId
  actionDefinitionId: ActionDefinition["id"]
  selectedTargets: null
}>

/**
 * The action is submitted when its selected targets are set.
 */
export type SubmittedAction = Readonly<{
  id: ActionId
  playerId: PlayerId
  actionDefinitionId: ActionDefinition["id"]
  /**
   * Contains the target ids selected for the target slots required by the ActionDefinition.
   */
  selectedTargets: SelectedTargets
}>
