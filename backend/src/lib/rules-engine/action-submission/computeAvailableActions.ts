import { v4 } from "uuid"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { AvailableAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"

/**
 * I don't like the shape of this, but it definitely lives under rules-engine/
 *
 * Computes the Action instances available to every player for a Turn.
 * For now this is simplistic, in the long run this will involve picking actions from the ruleset based on Ideological Alignments
 */
export function computeAvailableActions({ playerIds, ruleset }: { playerIds: readonly PlayerId[]; ruleset: Ruleset }): AvailableAction[] {
  return playerIds.flatMap((playerId) =>
    Object.values(ruleset.actionDefinitions).map(({ id: actionDefinitionId }) => ({
      id: v4(),
      playerId,
      actionDefinitionId,
      targets: null,
    })),
  )
}
