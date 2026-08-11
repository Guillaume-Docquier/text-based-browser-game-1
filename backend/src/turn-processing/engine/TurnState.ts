import type { ActionSubmission } from "#turn-processing/engine/actions/ActionSubmission.ts"

/**
 * The current state of the turn.
 */
export type TurnState = {
  players: Array<{
    actions: ActionSubmission[]
  }>
}
