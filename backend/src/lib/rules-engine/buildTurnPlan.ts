import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ResolvedTargets } from "#lib/rules-engine/actions/ResolvedTargets.ts"
import { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { TurnState } from "#lib/rules-engine/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

export type InvalidActionSubmission =
  | {
      readonly actionSubmissionId: ActionSubmission["id"]
      readonly playerId: PlayerId
      readonly reason: "DUPLICATE_ACTION_SUBMISSION_ID" | "UNKNOWN_ACTION_DEFINITION"
    }
  | {
      readonly actionSubmissionId: ActionSubmission["id"]
      readonly playerId: PlayerId
      readonly reason: "MISSING_TARGET"
      readonly targetTag: string
    }

/**
 * The deterministic Effects and submission diagnostics prepared for one Turn Resolution.
 */
export type TurnPlan = {
  readonly effects: readonly Effect[]
  readonly invalidActionSubmissions: readonly InvalidActionSubmission[]
}

/**
 * Validates locked Action Submissions and compiles their configured Mechanics into concrete Effects.
 */
export function buildTurnPlan(turnState: TurnState, ruleset: Ruleset): TurnPlan {
  const effects: Effect[] = []
  const invalidActionSubmissions: InvalidActionSubmission[] = []
  const seenSubmissionIds = new Set<ActionSubmission["id"]>()
  const players = Object.values(turnState.players).toSorted((left, right) => compareStrings(left.id, right.id))

  for (const player of players) {
    const actionSubmissions = player.actionSubmissions.toSorted((left, right) => compareStrings(left.id, right.id))

    for (const actionSubmission of actionSubmissions) {
      if (seenSubmissionIds.has(actionSubmission.id)) {
        invalidActionSubmissions.push({
          actionSubmissionId: actionSubmission.id,
          playerId: player.id,
          reason: "DUPLICATE_ACTION_SUBMISSION_ID",
        })
        continue
      }
      seenSubmissionIds.add(actionSubmission.id)

      const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
      if (actionDefinition === undefined) {
        invalidActionSubmissions.push({
          actionSubmissionId: actionSubmission.id,
          playerId: player.id,
          reason: "UNKNOWN_ACTION_DEFINITION",
        })
        continue
      }

      const targets: ResolvedTargets = {
        ...actionSubmission.targets,
        self: player.id,
      }
      const missingTargetTag = Object.keys(actionDefinition.targets).find(
        (targetTag) => targets[targetTag] === undefined || targets[targetTag].length === 0,
      )
      if (missingTargetTag !== undefined) {
        invalidActionSubmissions.push({
          actionSubmissionId: actionSubmission.id,
          playerId: player.id,
          reason: "MISSING_TARGET",
          targetTag: missingTargetTag,
        })
        continue
      }

      effects.push(
        ...actionDefinition.costs.map((mechanic, mechanicIndex) =>
          Effect.fromMechanic({
            actionDefinitionId: actionDefinition.id,
            actionSubmissionId: actionSubmission.id,
            mechanic,
            mechanicIndex,
            mechanicPosition: "COST",
            targets,
          }),
        ),
        ...actionDefinition.mechanics.map((mechanic, mechanicIndex) =>
          Effect.fromMechanic({
            actionDefinitionId: actionDefinition.id,
            actionSubmissionId: actionSubmission.id,
            mechanic,
            mechanicIndex,
            mechanicPosition: "MECHANIC",
            targets,
          }),
        ),
      )
    }
  }

  return {
    effects,
    invalidActionSubmissions,
  }
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
