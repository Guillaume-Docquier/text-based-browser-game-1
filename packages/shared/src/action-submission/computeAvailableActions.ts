import { indexBy } from "@guillaume-docquier/tools-ts"
import { isActionOccupied } from "#shared/action-submission/actionEligibility.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { AvailableAction } from "#shared/domain/turns/actions/Action.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"

/**
 * Computes each player's available Actions from the Ruleset's current Action Pool.
 *
 * Eventually this will decide based on ideological alignments as well.
 */
export function computeAvailableActions({
  playerIds,
  ruleset,
  fleets = [],
}: {
  playerIds: readonly PlayerId[]
  ruleset: Ruleset
  fleets?: ReadonlyArray<Readonly<Fleet>>
}): AvailableAction[] {
  return playerIds.flatMap((playerId) =>
    ruleset.actionPool
      .filter((entry) => !isActionOccupied({ fleets: indexBy("id", fleets) }, { id: entry.id, playerId }))
      .map(({ id, actionDefinitionId }) => ({
        id,
        playerId,
        actionDefinitionId,
        selectedTargets: null,
        selectedInputs: null,
      })),
  )
}
