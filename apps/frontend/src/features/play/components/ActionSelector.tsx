import type { Action, ActionDefinition, ActionTier, GameId, GamePlayers, PlayerView, Ruleset, SelectedTargets } from "@api-types"
import { Sort } from "@guillaume-docquier/tools-ts"
import { AlertTriangle } from "lucide-react"
import type { ReactElement } from "react"
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
  players: GamePlayers
}): ReactElement {
  const updateActionSubmission = useUpdateActionSubmission()
  const isTurnLocked = playerView.turnStatus !== "COLLECTING_ACTIONS" || playerView.player.isReady

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-stretch gap-6 px-4 pt-4">
        {playerView.actions
          .map(toActionAndDefinition(playerView.ruleset.actionDefinitions))
          .sort(sortByTier)
          .map(({ action, definition }) => {
            const isSelected = action.selectedTargets !== null
            const selectAction = (selectedTargets: SelectedTargets): void => {
              updateActionSubmission.mutate({
                gameId,
                turn: playerView.turn,
                submittedActionTargets: {
                  actionId: action.id,
                  selectedTargets,
                },
              })
            }
            return (
              <ActionCard
                key={action.id}
                actionDefinition={definition}
                action={action}
                playerView={playerView}
                players={players}
                resources={playerView.resources}
                canAfford={action.canAfford}
                isSelected={isSelected}
                disabled={isTurnLocked || (!action.canAfford && !isSelected)}
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
