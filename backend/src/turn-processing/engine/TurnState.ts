import type { ActionSubmission } from "#turn-processing/engine/action/ActionSubmission.ts"

/**
 * The current state of the turn.
 */
export type TurnState = {
  players: {
    actions: ActionSubmission[]
  }
}
