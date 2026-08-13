import type { Rng } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ResourceType } from "#lib/rules-engine/mechanics/ResourceType.ts"

/**
 * The current state of the turn.
 */
export type TurnState = {
  /**
   * Rng when you need it.
   * Will be seeded and persisted so runs are fully deterministic.
   */
  rng: Rng
  players: Record<
    PlayerId,
    {
      id: PlayerId
      resources: Record<ResourceType, number>
      actionSubmissions: ActionSubmission[]
    }
  >
}
