import type { ActionId } from "#lib/db/actions/ActionId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { ActionDefinitionId } from "#lib/db/rulesets/ActionDefinitionId.ts"
import type { SelectedTargets } from "#lib/rules-engine/action-submission/SelectedTargets.ts"

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
