import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

/**
 * The current state of the turn.
 */
export type TurnState = {
  players: Record<
    PlayerId,
    {
      id: PlayerId
      resources: Record<ResourceType, number>
      actionSubmissions: ActionSubmission[]
    }
  >
  /**
   * If set, the game ends.
   */
  winnerPlayerId: PlayerId | undefined
}
