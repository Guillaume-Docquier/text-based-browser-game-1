import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { ActionDefinition } from "#turn-processing/engine/actions/ActionDefinition.ts"

/**
 * The submitted action payload that invokes an ActionDefinition with a target and a source.
 */
export type ActionSubmission = {
  id: string
  submittedByPlayerId: PlayerId
  actionDefinitionId: ActionDefinition["id"]
  sourceId: string
  targetId: string
}
