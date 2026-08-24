import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"

/**
 * An Action Definition offered to one player for a Turn.
 */
export type AvailableAction = Readonly<{
  playerId: PlayerId
  actionDefinitionId: ActionDefinition["id"]
}>

/**
 * Computes the Action instances available to every player for a Turn.
 */
export function computeAvailableActions({ playerIds, ruleset }: { playerIds: readonly PlayerId[]; ruleset: Ruleset }): AvailableAction[] {
  return playerIds.flatMap((playerId) =>
    Object.values(ruleset.actionDefinitions).map(({ id: actionDefinitionId }) => ({
      playerId,
      actionDefinitionId,
    })),
  )
}
