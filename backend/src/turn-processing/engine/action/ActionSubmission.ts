import type { ActionDefinition } from "#turn-processing/engine/action/ActionDefinition.ts"

/**
 * The submitted action payload that invokes an ActionDefinition with a target and a source.
 */
export type ActionSubmission = {
  id: string
  actionDefinitionId: ActionDefinition["id"]
  sourceId: string
  targetId: string
}
