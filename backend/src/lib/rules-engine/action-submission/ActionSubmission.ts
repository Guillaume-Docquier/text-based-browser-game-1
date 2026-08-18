import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { ResolvedTargets } from "#lib/rules-engine/ruleset-model/actions/ResolvedTargets.ts"

/**
 * The submitted action payload that invokes an ActionDefinition with a target and a source.
 */
export type ActionSubmission = Readonly<{
  id: string
  submittedByPlayerId: PlayerId
  actionDefinitionId: ActionDefinition["id"]
  /**
   * Contains the targets to fill required by the ActionDefinition.
   * Contains the special "self" key that the server will always override.
   */
  targets: ResolvedTargets
}>
