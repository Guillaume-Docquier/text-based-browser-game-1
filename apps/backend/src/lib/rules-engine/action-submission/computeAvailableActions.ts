import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { AvailableAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"

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
