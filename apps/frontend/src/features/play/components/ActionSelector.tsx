import type {
  Action,
  ActionDefinition,
  ActionTier,
  GameId,
  Players,
  PlayerView,
  Ruleset,
  SelectedInputs,
  SelectedTargets,
} from "@api-types"
import { Sort, indexBy } from "@guillaume-docquier/tools-ts"
import { safeTypedParse } from "@guillaume-docquier/tools-ts/schemas"
import { AlertTriangle } from "lucide-react"
import type { ReactElement } from "react"
import type { EligibilityState } from "shared/action-submission/evaluateActionSelection.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { RulesetSchema, type Ruleset as SharedRuleset } from "shared/domain/ruleset/Ruleset.ts"
import { AvailableActionSchema, SubmittedActionSchema } from "shared/domain/turns/actions/Action.ts"
import type { Action as SharedAction } from "shared/domain/turns/actions/Action.ts"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { ActionCard } from "@/features/play/components/ActionCard.tsx"
import { useUpdateActionSubmission } from "@/lib/api/useUpdateActionSubmission.ts"

// This should probably be data driven
export const ActionTierRank = {
  BASIC: 1, // Worst
  STANDARD: 2,
  IMPROVED: 3,
  ADVANCED: 4,
  EXCEPTIONAL: 5, // Best
} as const satisfies Record<ActionTier, number>

const NUMERIC_COMPARATOR = Sort.numeric()

export function ActionSelector({
  gameId,
  playerView,
  players,
}: {
  gameId: GameId
  playerView: PlayerView
  players: Players
}): ReactElement {
  const updateActionSubmission = useUpdateActionSubmission()
  const isTurnLocked = playerView.turnStatus !== "COLLECTING_ACTIONS" || playerView.player.isReady
  const eligibilityResult = createEligibilityState(playerView)

  if (!eligibilityResult.success) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Could not validate available actions</AlertTitle>
        <AlertDescription>{eligibilityResult.message}</AlertDescription>
      </Alert>
    )
  }

  const { eligibilityState, ruleset } = eligibilityResult

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-stretch gap-6 px-4 pt-4">
        {playerView.actions
          .map(toActionAndDefinition(playerView.ruleset.actionDefinitions))
          .sort(sortByTier)
          .map(({ action, definition }) => {
            const selectAction = (selectedTargets: SelectedTargets | null, selectedInputs: SelectedInputs | null): void => {
              updateActionSubmission.mutate({
                gameId,
                turn: playerView.turn,
                submittedActionTargets: {
                  actionId: action.id,
                  selectedTargets,
                  selectedInputs,
                },
              })
            }
            return (
              <ActionCard
                key={`${action.id}-${playerView.turn}`}
                actionDefinition={definition}
                action={action}
                playerView={playerView}
                players={players}
                ruleset={ruleset}
                eligibilityState={eligibilityState}
                disabled={isTurnLocked || action.isInProgress}
                onSelect={selectAction}
              />
            )
          })}
      </div>

      {updateActionSubmission.isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Could not update action</AlertTitle>
          <AlertDescription>{updateActionSubmission.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}

type ActionAndDefinition = { action: Action; definition: ActionDefinition }

function toActionAndDefinition(actionDefinitions: Ruleset["actionDefinitions"]): (action: Action) => ActionAndDefinition {
  return (action) => ({ action, definition: actionDefinitions[action.actionDefinitionId] })
}

function sortByTier(first: ActionAndDefinition, second: ActionAndDefinition): number {
  const tierOrder = NUMERIC_COMPARATOR(ActionTierRank[first.definition.tier], ActionTierRank[second.definition.tier])
  if (tierOrder !== 0) {
    return tierOrder
  }

  const nameOrder = first.definition.name.localeCompare(second.definition.name)
  if (nameOrder !== 0) {
    return nameOrder
  }

  return first.action.id.localeCompare(second.action.id)
}

export function createEligibilityState(
  playerView: PlayerView,
): { success: true; eligibilityState: EligibilityState; ruleset: SharedRuleset } | { success: false; message: string } {
  const rulesetResult = safeTypedParse(RulesetSchema, playerView.ruleset)
  if (!rulesetResult.success) {
    return { success: false, message: rulesetResult.error.message }
  }

  const actions: Array<{ success: true; action: SharedAction } | { success: false; message: string }> = playerView.actions.map((action) => {
    const common = {
      id: action.id,
      playerId: playerView.player.id,
      actionDefinitionId: action.actionDefinitionId,
    }
    if (action.selectedTargets === null && action.selectedInputs === null) {
      const parsed = safeTypedParse(AvailableActionSchema, { ...common, selectedTargets: null, selectedInputs: null })
      return parsed.success ? { success: true as const, action: parsed.data } : { success: false as const, message: parsed.error.message }
    }
    if (action.selectedTargets !== null && action.selectedInputs !== null) {
      const parsed = safeTypedParse(SubmittedActionSchema, {
        ...common,
        selectedTargets: action.selectedTargets,
        selectedInputs: action.selectedInputs,
      })
      return parsed.success ? { success: true as const, action: parsed.data } : { success: false as const, message: parsed.error.message }
    }
    return { success: false as const, message: `Action ${action.id} has incomplete target and input selections.` }
  })
  const invalidAction = actions.find((result): result is { success: false; message: string } => !result.success)
  if (invalidAction !== undefined) {
    return { success: false, message: invalidAction.message }
  }

  const playerIds = [playerView.player, ...Object.values(playerView.opponents)].map(({ id }) => ({ id, ownerPlayerId: id }))
  const planets = playerView.galaxy.systems.flatMap(({ planets: systemPlanets }) =>
    systemPlanets.map(({ id, ownerPlayerId, x, y }) => ({ id, ownerPlayerId, x, y })),
  )

  return {
    success: true,
    ruleset: rulesetResult.data,
    eligibilityState: {
      gameId: playerView.gameId,
      turn: playerView.turn,
      submittingPlayerId: playerView.player.id,
      resources: {
        [ResourceType.INFLUENCE]: playerView.resources[ResourceType.INFLUENCE].total,
        [ResourceType.METAL]: playerView.resources[ResourceType.METAL].total,
        [ResourceType.FUEL]: playerView.resources[ResourceType.FUEL].total,
        [ResourceType.ENERGY]: playerView.resources[ResourceType.ENERGY].total,
        [ResourceType.COLONY]: playerView.resources[ResourceType.COLONY].total,
      },
      players: indexBy("id", playerIds),
      planets: indexBy("id", planets),
      fleets: indexBy("id", playerView.fleets),
      actions: actions.flatMap((result) => (result.success ? [result.action] : [])),
    },
  }
}
