import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

/**
 * The current state of the turn.
 * This is generally mutated.
 */
export type TurnState = {
  readonly submittedActions: readonly SubmittedAction[]
  readonly players: Readonly<
    Record<
      PlayerId,
      {
        id: PlayerId
        resources: Record<ResourceType, number>
      }
    >
  >
  /**
   * If set, the game ends.
   */
  winnerPlayerId: PlayerId | undefined
}
