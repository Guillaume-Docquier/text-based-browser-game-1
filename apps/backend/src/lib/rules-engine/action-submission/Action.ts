import type { ActionId } from "#lib/db/actions/ActionId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SelectedTargets } from "#lib/rules-engine/action-submission/SelectedTargets.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"

export type Action = AvailableAction | SubmittedAction

/**
 * Each Ruleset Action Pool entry gives this Action a stable identifier across turns.
 * The player and turn scope distinguish rows that share that identifier.
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
   * Contains selected target ids keyed by the tags of the action definition's target slots.
   */
  selectedTargets: SelectedTargets
}>
