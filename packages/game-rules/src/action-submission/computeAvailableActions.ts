import type { AvailableAction } from "#game-rules/action-submission/Action.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import type { Ruleset } from "#game-rules/ruleset/Ruleset.ts"

/**
 * Computes each player's available Actions from the Ruleset's current Action Pool.
 *
 * Eventually this will decide based on ideological alignments as well.
 */
export function computeAvailableActions({ playerIds, ruleset }: { playerIds: readonly PlayerId[]; ruleset: Ruleset }): AvailableAction[] {
  return playerIds.flatMap((playerId) =>
    ruleset.actionPool.map(({ id, actionDefinitionId }) => ({
      id,
      playerId,
      actionDefinitionId,
      selectedTargets: null,
    })),
  )
}
