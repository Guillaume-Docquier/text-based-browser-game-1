import type { SelectedTargets } from "#game-rules/action-submission/SelectedTargets.ts"
import type { ActionDefinitionId } from "#game-rules/models/ActionDefinitionId.ts"
import type { ActionId } from "#game-rules/models/ActionId.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"

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
