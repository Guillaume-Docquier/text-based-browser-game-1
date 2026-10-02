import type { AvailableAction } from "#shared/domain/actions/Action.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"

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
