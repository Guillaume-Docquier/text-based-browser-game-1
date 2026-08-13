import type { ActionDefinition } from "#lib/rules-engine/actions/ActionDefinition.ts"
import type { ResolvedTargets } from "#lib/rules-engine/actions/ResolvedTargets.ts"

/**
 * The submitted action payload that invokes an ActionDefinition with a target and a source.
 */
export type ActionSubmission = {
  readonly id: string
  readonly actionDefinitionId: ActionDefinition["id"]
  /**
   * Contains the targets to fill required by the ActionDefinition.
   * Contains the special "self" key that the backend will always override.
   */
  readonly targets: ResolvedTargets
}
