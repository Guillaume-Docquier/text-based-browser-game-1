import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"

/**
 * The current state of the turn.
 * This is generally mutated.
 */
export type TurnState = {
  readonly submittedActions: readonly SubmittedAction[]
  readonly players: Readonly<
    Record<
      string,
      {
        id: PlayerId
        resources: Resources
      }
    >
  >
  /**
   * If set, the game ends.
   */
  winnerPlayerId: PlayerId | undefined
}
